import {
    sleep,
    spawn,
    suspend,
    useAbortSignal as effectionAbortSignal,
    type Operation as EffectionOperation,
} from 'effection';
import {
    DidWebsAutoApprover,
    type DidWebsAutoApproveResult,
    type SignifyClient,
    type SignedReplyEnvelope,
} from 'signify-ts';
import { callPromise, toErrorText } from '../effects/promise';
import { AppServicesContext, type AppServices } from '../effects/contexts';
import { appNotificationRecorded } from '../state/appNotifications.slice';

const minimumDidWebsPollingMs = 7000;

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
    signal,
}: {
    client: SignifyClient;
    approver: DidWebsAutoApprover;
    signal: AbortSignal;
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
                await approver.handleEnvelope(envelope);
            }
        }

        const finalChunk = decoder.decode();
        for (const envelope of parser.push(finalChunk)) {
            await approver.handleEnvelope(envelope);
        }
        for (const envelope of parser.finish()) {
            await approver.handleEnvelope(envelope);
        }
    } finally {
        signal.removeEventListener('abort', cancelReader);
        reader.releaseLock();
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

    yield* spawn(() => didWebsSignalLoop(approver));
    yield* spawn(() => didWebsPollingLoop(approver));
    yield* suspend();
}

function* didWebsSignalLoop(
    approver: DidWebsAutoApprover
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
                    signal,
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
    approver: DidWebsAutoApprover
): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    let consecutiveFailures = 0;
    let warned = false;

    while (true) {
        try {
            yield* callPromise(() => approvePendingDidWebsRequests(approver));
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
        (message.includes('did:webs') && message.includes('404 Not Found'))
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
