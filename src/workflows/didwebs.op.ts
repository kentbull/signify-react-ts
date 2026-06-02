import {
    sleep,
    spawn,
    suspend,
    useAbortSignal as effectionAbortSignal,
    type Operation as EffectionOperation,
} from 'effection';
import {
    DidWebsAutoApprover,
    DWS_SIGNING_ROUTE,
    type DidWebsAutoApproveResult,
    type SignifyClient,
    type SignedReplyEnvelope,
} from 'signify-ts';
import { callPromise, toErrorText } from '../effects/promise';
import { AppServicesContext, type AppServices } from '../effects/contexts';
import { appNotificationRecorded } from '../state/appNotifications.slice';
import {
    didWebsDidFailed,
    didWebsDidLoaded,
    didWebsDidLoading,
    didWebsPendingObserved,
    didWebsReadyObserved,
    type DidWebsDidPayload,
} from '../state/didwebs.slice';

const minimumDidWebsPollingMs = 7000;
const DWS_READY_ROUTE = '/didwebs/ready';
const W3C_SIGNING_ROUTE = '/w3c/signing/request';
const W3C_IMPORT_ROUTE = '/w3c/credentials/import-request';

/** Verified did:webs signal payload observed from the generic agent stream. */
export interface ObservedDidWebsSignal {
    route: string;
    payload: Record<string, unknown>;
    envelope: SignedReplyEnvelope;
}

export type DidWebsSignalObserver = (
    signal: ObservedDidWebsSignal
) => void | Promise<void>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

interface ReactW3CAutomationResult {
    outcome: 'submitted' | 'imported' | 'skipped' | 'blocked' | 'failed' | 'rejected';
    requestId?: string;
    error?: string;
}

const decodeBase64Url = (input: string): Uint8Array => {
    const padded = `${input}${'='.repeat((4 - (input.length % 4)) % 4)}`;
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = globalThis.atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

class ReactW3CEdgeAutomator {
    private readonly seen = new Set<string>();

    constructor(private readonly client: SignifyClient) {}

    async handleEnvelope(
        envelope: SignedReplyEnvelope
    ): Promise<ReactW3CAutomationResult> {
        const route = isRecord(envelope.rpy) ? stringValue(envelope.rpy.r) : null;
        if (route !== W3C_SIGNING_ROUTE && route !== W3C_IMPORT_ROUTE) {
            return { outcome: 'rejected', error: `unsupported W3C route ${route}` };
        }
        const verified = this.client
            .signals()
            .verifyReplyEnvelope(envelope, { route });
        if (!verified) {
            return {
                outcome: 'rejected',
                error: `W3C signal envelope failed verification for ${route}`,
            };
        }
        const payload = isRecord(envelope.rpy)
            ? (envelope.rpy.a as Record<string, unknown> | undefined)
            : undefined;
        return route === W3C_SIGNING_ROUTE
            ? this.handleSigningRequest(payload)
            : this.handleImportRequest(payload);
    }

    async pollOnce(): Promise<ReactW3CAutomationResult[]> {
        const names = await this.managedNames();
        const results: ReactW3CAutomationResult[] = [];
        for (const name of names) {
            for (const request of await this.getRequests(
                `/identifiers/${name}/w3c/credentials/import-requests`
            )) {
                results.push(await this.handleImportRequest(request));
            }
        }
        for (const name of names) {
            for (const request of await this.getRequests(
                `/identifiers/${name}/w3c/signing-requests`
            )) {
                results.push(await this.handleSigningRequest(request));
            }
        }
        return results;
    }

    async reconcile(): Promise<ReactW3CAutomationResult[]> {
        return [];
    }

    private async handleSigningRequest(
        request: Record<string, unknown> | undefined
    ): Promise<ReactW3CAutomationResult> {
        const id = stringValue(request?.d);
        const name = stringValue(request?.name);
        const aid = stringValue(request?.aid);
        const signingInputB64 = stringValue(request?.signingInputB64);
        if (id === null || name === null || aid === null || signingInputB64 === null) {
            return { outcome: 'rejected', error: 'W3C signing request is malformed' };
        }
        if (this.seen.has(id)) {
            return { outcome: 'skipped', requestId: id };
        }
        const ownershipError = await this.localOwnershipError(name, aid, id);
        if (ownershipError !== null) {
            this.seen.add(id);
            return { outcome: 'rejected', requestId: id, error: ownershipError };
        }
        try {
            const hab = await this.client.identifiers().get(name);
            const keeper = this.client.manager!.get(hab);
            const sigs = await keeper.sign(decodeBase64Url(signingInputB64), false);
            const firstSig = sigs[0] as string | { qb64: string };
            const signature =
                typeof firstSig === 'string' ? firstSig : firstSig.qb64;
            await this.client.fetch(
                `/identifiers/${name}/w3c/signing-requests/${encodeURIComponent(id)}/signatures`,
                'POST',
                { signature }
            );
            this.seen.add(id);
            return { outcome: 'submitted', requestId: id };
        } catch (error) {
            return { outcome: 'failed', requestId: id, error: toErrorText(error) };
        }
    }

    private async handleImportRequest(
        request: Record<string, unknown> | undefined
    ): Promise<ReactW3CAutomationResult> {
        const id = stringValue(request?.d) ?? stringValue(request?.importRequestId);
        const holderName = stringValue(request?.holderName);
        const holderAid = stringValue(request?.holderAid);
        const state = stringValue(request?.state);
        if (id === null || holderName === null || holderAid === null) {
            return { outcome: 'rejected', error: 'W3C import request is malformed' };
        }
        if (this.seen.has(id)) {
            return { outcome: 'skipped', requestId: id };
        }
        const ownershipError = await this.localOwnershipError(holderName, holderAid, id);
        if (ownershipError !== null) {
            this.seen.add(id);
            return { outcome: 'rejected', requestId: id, error: ownershipError };
        }
        if (state === 'blocked_native_vrd') {
            this.seen.add(id);
            return {
                outcome: 'blocked',
                requestId: id,
                error: stringValue(request?.error) ?? 'W3C import is blocked',
            };
        }
        if (state !== null && state !== 'pending') {
            this.seen.add(id);
            return { outcome: 'rejected', requestId: id, error: `W3C import request is ${state}` };
        }
        try {
            await this.client.fetch(
                `/identifiers/${holderName}/w3c/credentials/import`,
                'POST',
                { importRequestId: id }
            );
            this.seen.add(id);
            return { outcome: 'imported', requestId: id };
        } catch (error) {
            return { outcome: 'failed', requestId: id, error: toErrorText(error) };
        }
    }

    private async getRequests(path: string): Promise<Record<string, unknown>[]> {
        const response = await this.client.fetch(path, 'GET', null);
        const body = (await response.json()) as { requests?: unknown[] };
        return (body.requests ?? []).filter(isRecord);
    }

    private async managedNames(): Promise<string[]> {
        const result = await this.client.identifiers().list();
        return result.aids
            .map((aid: { name?: unknown }) => stringValue(aid.name))
            .filter((name: string | null): name is string => name !== null);
    }

    private async localOwnershipError(
        name: string,
        aid: string,
        requestId: string
    ): Promise<string | null> {
        try {
            const hab = await this.client.identifiers().get(name);
            return hab.prefix === aid
                ? null
                : `W3C request ${requestId} targets ${aid}, but local identifier ${name} is ${hab.prefix}`;
        } catch (error) {
            return `W3C request ${requestId} targets ${aid}, but local identifier ${name} is unavailable: ${toErrorText(error)}`;
        }
    }
}

/**
 * Incremental parser for JSON-valued Server-Sent Event frames.
 *
 * KERIA's `/signals/stream` returns a normal SSE stream, but browser
 * `EventSource` cannot attach Signify authentication headers. The app consumes
 * the authenticated `fetch` response body and feeds arbitrary text chunks into
 * this parser. The `retry` prelude and any future non-JSON events are ignored.
 */
export class SseJsonEnvelopeParser {
    private buffer = '';

    /**
     * Add one decoded text chunk and return every complete JSON envelope found.
     */
    push(chunk: string): SignedReplyEnvelope[] {
        this.buffer += chunk;
        const envelopes: SignedReplyEnvelope[] = [];

        while (true) {
            const boundary = this.nextBoundary();
            if (boundary === null) {
                break;
            }

            const frame = this.buffer.slice(0, boundary.index);
            this.buffer = this.buffer.slice(boundary.index + boundary.length);
            const envelope = this.parseFrame(frame);
            if (envelope !== null) {
                envelopes.push(envelope);
            }
        }

        return envelopes;
    }

    /**
     * Flush a final unterminated frame when a stream closes cleanly.
     */
    finish(): SignedReplyEnvelope[] {
        const frame = this.buffer;
        this.buffer = '';
        if (frame.trim().length === 0) {
            return [];
        }

        const envelope = this.parseFrame(frame);
        return envelope === null ? [] : [envelope];
    }

    private nextBoundary(): { index: number; length: number } | null {
        const candidates = ['\r\n\r\n', '\n\n', '\r\r']
            .map((marker) => ({
                index: this.buffer.indexOf(marker),
                length: marker.length,
            }))
            .filter((candidate) => candidate.index >= 0)
            .sort((a, b) => a.index - b.index);

        return candidates[0] ?? null;
    }

    private parseFrame(frame: string): SignedReplyEnvelope | null {
        const data = frame
            .split(/\r\n|\n|\r/)
            .flatMap((line) => {
                if (line.startsWith(':')) {
                    return [];
                }
                if (!line.startsWith('data:')) {
                    return [];
                }

                const value = line.slice('data:'.length);
                return [value.startsWith(' ') ? value.slice(1) : value];
            })
            .join('\n');

        if (data.trim().length === 0) {
            return null;
        }

        try {
            return JSON.parse(data) as SignedReplyEnvelope;
        } catch {
            return null;
        }
    }
}

/**
 * Consume one authenticated KERIA agent signal stream until it closes or aborts.
 */
export const consumeDidWebsSignalStream = async ({
    client,
    approver,
    w3cApprover,
    signal,
    observer,
}: {
    client: SignifyClient;
    approver: DidWebsAutoApprover;
    w3cApprover?: ReactW3CEdgeAutomator;
    signal: AbortSignal;
    observer?: DidWebsSignalObserver;
}): Promise<void> => {
    const response = await client.signals().stream();
    if (response.body === null) {
        throw new Error('KERIA signal stream response did not include a body');
    }

    const reader = response.body.getReader();
    if (signal.aborted) {
        await reader.cancel(signal.reason).catch(() => undefined);
        reader.releaseLock();
        return;
    }

    const decoder = new TextDecoder();
    const parser = new SseJsonEnvelopeParser();
    const cancelReader = () => {
        void reader.cancel(signal.reason).catch(() => undefined);
    };
    signal.addEventListener('abort', cancelReader, { once: true });

    try {
        while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            for (const envelope of parser.push(chunk)) {
                await handleSignalEnvelope({
                    envelope,
                    didWebsApprover: approver,
                    w3cApprover,
                });
                await observeDidWebsSignal(client, envelope, observer);
            }
        }

        const finalChunk = decoder.decode();
        for (const envelope of parser.push(finalChunk)) {
            await handleSignalEnvelope({
                envelope,
                didWebsApprover: approver,
                w3cApprover,
            });
            await observeDidWebsSignal(client, envelope, observer);
        }
        for (const envelope of parser.finish()) {
            await handleSignalEnvelope({
                envelope,
                didWebsApprover: approver,
                w3cApprover,
            });
            await observeDidWebsSignal(client, envelope, observer);
        }
    } finally {
        signal.removeEventListener('abort', cancelReader);
        reader.releaseLock();
    }
};

const handleSignalEnvelope = async ({
    envelope,
    didWebsApprover,
    w3cApprover,
}: {
    envelope: SignedReplyEnvelope;
    didWebsApprover: DidWebsAutoApprover;
    w3cApprover?: ReactW3CEdgeAutomator;
}): Promise<void> => {
    const route = isRecord(envelope.rpy) ? stringValue(envelope.rpy.r) : null;
    if (route === DWS_SIGNING_ROUTE) {
        await didWebsApprover.handleEnvelope(envelope);
    } else if (
        (route === W3C_SIGNING_ROUTE || route === W3C_IMPORT_ROUTE) &&
        w3cApprover !== undefined
    ) {
        await w3cApprover.handleEnvelope(envelope);
    }
};

const observeDidWebsSignal = async (
    client: SignifyClient,
    envelope: SignedReplyEnvelope,
    observer: DidWebsSignalObserver | undefined
): Promise<void> => {
    if (observer === undefined || !isRecord(envelope.rpy)) {
        return;
    }

    const route = stringValue(envelope.rpy.r);
    if (route !== DWS_SIGNING_ROUTE && route !== DWS_READY_ROUTE) {
        return;
    }

    if (
        !client.signals().verifyReplyEnvelope(envelope, {
            route,
        })
    ) {
        return;
    }

    const payload = isRecord(envelope.rpy.a) ? envelope.rpy.a : null;
    if (payload === null) {
        return;
    }

    try {
        await observer({
            route,
            payload,
            envelope,
        });
    } catch {
        // Status projection must not interrupt did:webs auto-approval.
    }
};

/**
 * Poll durable did:webs publication requests and reconcile completed ones.
 */
export const approvePendingDidWebsRequests = async (
    approver: DidWebsAutoApprover
): Promise<{
    pollResults: DidWebsAutoApproveResult[];
    reconciled: number;
}> => {
    const pollResults = await approver.pollOnce();
    const reconciled = await approver.reconcile();
    return {
        pollResults,
        reconciled: reconciled.length,
    };
};

/**
 * Poll durable W3C holder requests and reconcile completed ones.
 */
export const approvePendingW3CRequests = async (
    approver: ReactW3CEdgeAutomator
): Promise<{
    pollResults: ReactW3CAutomationResult[];
    reconciled: number;
}> => {
    const pollResults = await approver.pollOnce();
    const reconciled = await approver.reconcile();
    return {
        pollResults,
        reconciled: reconciled.length,
    };
};

/**
 * Poll did:webs and W3C signing queues independently.
 *
 * KERIA can expose or fail these queues independently, so one branch must not
 * starve the other foreground/background auto-approval path.
 */
export const approvePendingDidWebsAndW3CRequests = async ({
    approver,
    w3cApprover,
}: {
    approver: DidWebsAutoApprover;
    w3cApprover: ReactW3CEdgeAutomator;
}): Promise<{
    didWebs:
        | { ok: true; value: Awaited<ReturnType<typeof approvePendingDidWebsRequests>> }
        | { ok: false; error: unknown };
    w3c:
        | { ok: true; value: Awaited<ReturnType<typeof approvePendingW3CRequests>> }
        | { ok: false; error: unknown };
}> => {
    const didWebs = await settlePollingStep(() =>
        approvePendingDidWebsRequests(approver)
    );
    const w3c = await settlePollingStep(() =>
        approvePendingW3CRequests(w3cApprover)
    );
    return { didWebs, w3c };
};

const settlePollingStep = async <T>(
    step: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> => {
    try {
        return { ok: true, value: await step() };
    } catch (error) {
        return { ok: false, error };
    }
};

/**
 * Refresh one managed identifier did:webs DID into Redux.
 */
export function* refreshIdentifierDidWebsOp({
    name,
    aid,
}: {
    name: string;
    aid: string;
}): EffectionOperation<DidWebsDidPayload | null> {
    const services = yield* AppServicesContext.expect();
    const updatedAt = new Date().toISOString();
    services.store.dispatch(
        didWebsDidLoading({
            aid,
            updatedAt,
        })
    );

    try {
        const dws = yield* callPromise(() =>
            services.runtime.requireConnectedClient().identifiers().dws(name)
        );
        const payload: DidWebsDidPayload = {
            aid,
            did: dws.dws,
            didJsonUrl: dws.didJsonUrl,
            keriCesrUrl: dws.keriCesrUrl,
            updatedAt: new Date().toISOString(),
        };
        services.store.dispatch(didWebsDidLoaded(payload));
        return payload;
    } catch (error) {
        services.store.dispatch(
            didWebsDidFailed({
                aid,
                error: toErrorText(error),
                updatedAt: new Date().toISOString(),
            })
        );
        return null;
    }
}

/**
 * Session-scoped did:webs publication auto-approval coordinator.
 *
 * SSE is the low-latency path. Polling and reconcile are kept running as the
 * durable fallback because KERIA signals are intentionally transient and KERIA
 * remains the source of truth for completion.
 */
export function* liveDidWebsPublicationOp(): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    const client = services.runtime.requireConnectedClient();
    const approver = new DidWebsAutoApprover(client);
    const w3cApprover = new ReactW3CEdgeAutomator(client);

    yield* spawn(() =>
        didWebsSignalLoop(
            approver,
            w3cApprover,
            didWebsSignalObserver(services)
        )
    );
    yield* spawn(() => didWebsPollingLoop(approver, w3cApprover));
    yield* suspend();
}

const didWebsSignalObserver =
    (services: AppServices): DidWebsSignalObserver =>
    ({ route, payload }) => {
        const updatedAt = new Date().toISOString();
        const aid = stringValue(payload.aid);
        if (aid === null) {
            return;
        }

        if (route === DWS_READY_ROUTE) {
            const did = stringValue(payload.did);
            if (did === null) {
                return;
            }

            services.store.dispatch(
                didWebsReadyObserved({
                    aid,
                    did,
                    didJsonUrl: stringValue(payload.didJsonUrl),
                    keriCesrUrl: stringValue(payload.keriCesrUrl),
                    updatedAt,
                })
            );
            return;
        }

        services.store.dispatch(
            didWebsPendingObserved({
                aid,
                updatedAt,
            })
        );
    };

function* didWebsSignalLoop(
    approver: DidWebsAutoApprover,
    w3cApprover: ReactW3CEdgeAutomator,
    observer: DidWebsSignalObserver
): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    const signal = yield* effectionAbortSignal();
    let consecutiveFailures = 0;
    let warned = false;

    while (!signal.aborted) {
        try {
            yield* callPromise(() =>
                consumeDidWebsSignalStream({
                    client: services.runtime.requireConnectedClient(),
                    approver,
                    w3cApprover,
                    signal,
                    observer,
                })
            );
            consecutiveFailures = 0;
        } catch (error) {
            if (signal.aborted) {
                return;
            }

            if (!isOptionalDidWebsEndpointUnavailable(error)) {
                consecutiveFailures += 1;
                if (consecutiveFailures >= 3 && !warned) {
                    warned = true;
                    recordDidWebsWarning(
                        services,
                        'did:webs signal stream stalled',
                        error
                    );
                }
            }
        }

        yield* sleep(
            didWebsPollingDelayMs(services.config.operations.didWebsPollingMs)
        );
    }
}

function* didWebsPollingLoop(
    approver: DidWebsAutoApprover,
    w3cApprover: ReactW3CEdgeAutomator
): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    let didWebsConsecutiveFailures = 0;
    let w3cConsecutiveFailures = 0;
    let didWebsWarned = false;
    let w3cWarned = false;

    while (true) {
        const results = yield* callPromise(() =>
            approvePendingDidWebsAndW3CRequests({ approver, w3cApprover })
        );

        if (results.didWebs.ok) {
            didWebsConsecutiveFailures = 0;
        } else if (!isOptionalDidWebsEndpointUnavailable(results.didWebs.error)) {
            didWebsConsecutiveFailures += 1;
            if (didWebsConsecutiveFailures >= 3 && !didWebsWarned) {
                didWebsWarned = true;
                recordDidWebsWarning(
                    services,
                    'did:webs publication polling stalled',
                    results.didWebs.error
                );
            }
        }

        if (results.w3c.ok) {
            w3cConsecutiveFailures = 0;
        } else if (!isOptionalDidWebsEndpointUnavailable(results.w3c.error)) {
            w3cConsecutiveFailures += 1;
            if (w3cConsecutiveFailures >= 3 && !w3cWarned) {
                w3cWarned = true;
                recordDidWebsWarning(
                    services,
                    'W3C holder workflow polling stalled',
                    results.w3c.error
                );
            }
        }

        yield* sleep(
            didWebsPollingDelayMs(services.config.operations.didWebsPollingMs)
        );
    }
}

const didWebsPollingDelayMs = (configuredMs: number): number =>
    Math.max(minimumDidWebsPollingMs, configuredMs);

const isOptionalDidWebsEndpointUnavailable = (error: unknown): boolean => {
    const message = toErrorText(error);
    return (
        message.includes('HTTP GET /signals/stream - 404') ||
        (message.includes('HTTP GET /didwebs/signing/requests') &&
            message.includes('404 Not Found')) ||
        (message.includes('/w3c/signing-requests') &&
            message.includes('404 Not Found'))
    );
};

const recordDidWebsWarning = (
    services: AppServices,
    title: string,
    error: unknown
): void => {
    const createdAt = new Date().toISOString();
    services.store.dispatch(
        appNotificationRecorded({
            id: `didwebs-sync-${createdAt}`,
            severity: 'warning',
            status: 'unread',
            title,
            message: toErrorText(error),
            createdAt,
            readAt: null,
            operationId: null,
            links: [],
            payloadDetails: [],
        })
    );
};
