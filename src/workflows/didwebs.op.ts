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
    W3CProjectionAutoApprover,
    W3C_SIGNING_ROUTE,
    type DidWebsAutoApproveResult,
    type SignifyClient,
    type SignedReplyEnvelope,
    type W3CProjectionAutoApproveResult,
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
} from '../state/didwebs.slice';

const minimumDidWebsPollingMs = 7000;
const DWS_READY_ROUTE = '/didwebs/ready';

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
    w3cApprover?: W3CProjectionAutoApprover;
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
    w3cApprover?: W3CProjectionAutoApprover;
}): Promise<void> => {
    const route = isRecord(envelope.rpy) ? stringValue(envelope.rpy.r) : null;
    if (route === DWS_SIGNING_ROUTE) {
        await didWebsApprover.handleEnvelope(envelope);
    } else if (route === W3C_SIGNING_ROUTE && w3cApprover !== undefined) {
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
 * Poll durable W3C projection requests and reconcile completed ones.
 */
export const approvePendingW3CProjectionRequests = async (
    approver: W3CProjectionAutoApprover
): Promise<{
    pollResults: W3CProjectionAutoApproveResult[];
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
 * Refresh one managed identifier did:webs DID into Redux.
 */
export function* refreshIdentifierDidWebsOp({
    name,
    aid,
}: {
    name: string;
    aid: string;
}): EffectionOperation<string | null> {
    const services = yield* AppServicesContext.expect();
    const updatedAt = new Date().toISOString();
    services.store.dispatch(
        didWebsDidLoading({
            aid,
            updatedAt,
        })
    );

    try {
        const did = yield* callPromise(() =>
            services.runtime.requireConnectedClient().identifiers().dws(name)
        );
        const completedAt = new Date().toISOString();
        services.store.dispatch(
            didWebsDidLoaded({
                aid,
                did,
                updatedAt: completedAt,
            })
        );
        return did;
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
    const w3cApprover = new W3CProjectionAutoApprover(client);

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
    w3cApprover: W3CProjectionAutoApprover,
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
    w3cApprover: W3CProjectionAutoApprover
): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    let consecutiveFailures = 0;
    let warned = false;

    while (true) {
        try {
            yield* callPromise(async () => {
                await approvePendingDidWebsRequests(approver);
                await approvePendingW3CProjectionRequests(w3cApprover);
            });
            consecutiveFailures = 0;
        } catch (error) {
            if (!isOptionalDidWebsEndpointUnavailable(error)) {
                consecutiveFailures += 1;
                if (consecutiveFailures >= 3 && !warned) {
                    warned = true;
                    recordDidWebsWarning(
                        services,
                        'did:webs publication polling stalled',
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
