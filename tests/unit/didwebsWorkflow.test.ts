import { describe, expect, it, vi } from 'vitest';
import {
    approvePendingDidWebsAndW3CRequests,
    approvePendingDidWebsRequests,
    approvePendingW3CProjectionRequests,
    consumeDidWebsSignalStream,
    SseJsonEnvelopeParser,
} from '../../src/workflows/didwebs.op';
import type {
    DidWebsAutoApprover,
    DidWebsAutoApproveResult,
    SignifyClient,
    SignedReplyEnvelope,
    W3CProjectionAutoApprover,
    W3CProjectionAutoApproveResult,
} from 'signify-ts';

const envelope = (agent = 'Eagent'): SignedReplyEnvelope => ({
    rpy: {
        r: '/didwebs/signing/request',
        a: {
            d: 'request-id',
            agent,
        },
    },
    sigs: ['signature'],
});

const publicationPayload = {
    aid: 'Eaid',
    did: 'did:webs:example:dws:Eaid',
};

const publicationEnvelope = (
    route = '/didwebs/signing/request',
    payload: Record<string, unknown> = {
        ...publicationPayload,
        action: 'create_registry',
    }
): SignedReplyEnvelope => ({
    rpy: {
        r: route,
        a: payload,
    },
    sigs: ['signature'],
});

describe('did:webs workflow SSE parsing', () => {
    it('ignores the retry prelude and parses JSON data frames across chunks', () => {
        const parser = new SseJsonEnvelopeParser();

        expect(parser.push('retry: 5000\n\n')).toEqual([]);
        expect(
            parser.push('id: request-id\nevent: didwebs.registry.create\n')
        ).toEqual([]);
        expect(
            parser.push(
                `data: ${JSON.stringify(envelope())}\n\nretry: 5000\n\n`
            )
        ).toEqual([envelope()]);
        expect(parser.finish()).toEqual([]);
    });

    it('ignores complete non-JSON data frames from other signal topics', () => {
        const parser = new SseJsonEnvelopeParser();

        expect(parser.push('event: other.topic\ndata: not json\n\n')).toEqual(
            []
        );
    });

    it('consumes a fetch-backed signal stream and hands envelopes to the approver', async () => {
        const response = new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode('retry: 5000\n\n')
                    );
                    controller.enqueue(
                        new TextEncoder().encode(
                            `data: ${JSON.stringify(envelope())}\n\n`
                        )
                    );
                    controller.close();
                },
            })
        );
        const client = {
            signals: () => ({
                stream: vi.fn(async () => response),
            }),
        } as unknown as SignifyClient;
        const approver = {
            handleEnvelope: vi.fn(async (received: SignedReplyEnvelope) => {
                expect(received).toEqual(envelope());
                return {
                    outcome: 'submitted',
                } satisfies DidWebsAutoApproveResult;
            }),
        } as unknown as DidWebsAutoApprover;

        await consumeDidWebsSignalStream({
            client,
            approver,
            signal: new AbortController().signal,
        });

        expect(approver.handleEnvelope).toHaveBeenCalledTimes(1);
    });

    it('observes verified signing request envelopes without disrupting approval', async () => {
        const signal = publicationEnvelope();
        const response = new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode(
                            `data: ${JSON.stringify(signal)}\n\n`
                        )
                    );
                    controller.close();
                },
            })
        );
        const stream = vi.fn(async () => response);
        const verifyReplyEnvelope = vi.fn(() => true);
        const client = {
            signals: () => ({
                stream,
                verifyReplyEnvelope,
            }),
        } as unknown as SignifyClient;
        const approver = {
            handleEnvelope: vi.fn(async () => ({
                outcome: 'submitted',
            })),
        } as unknown as DidWebsAutoApprover;
        const observer = vi.fn();

        await consumeDidWebsSignalStream({
            client,
            approver,
            signal: new AbortController().signal,
            observer,
        });

        expect(approver.handleEnvelope).toHaveBeenCalledWith(signal);
        expect(observer).toHaveBeenCalledWith(
            expect.objectContaining({
                route: '/didwebs/signing/request',
                payload: expect.objectContaining(publicationPayload),
            })
        );
    });

    it('observes verified ready envelopes from the shared signal stream', async () => {
        const ready = publicationEnvelope('/didwebs/ready', publicationPayload);
        const response = new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode(
                            `data: ${JSON.stringify(ready)}\n\n`
                        )
                    );
                    controller.close();
                },
            })
        );
        const client = {
            signals: () => ({
                stream: vi.fn(async () => response),
                verifyReplyEnvelope: vi.fn(() => true),
            }),
        } as unknown as SignifyClient;
        const approver = {
            handleEnvelope: vi.fn(async () => ({
                outcome: 'rejected',
            })),
        } as unknown as DidWebsAutoApprover;
        const observer = vi.fn();

        await consumeDidWebsSignalStream({
            client,
            approver,
            signal: new AbortController().signal,
            observer,
        });

        expect(observer).toHaveBeenCalledWith(
            expect.objectContaining({
                route: '/didwebs/ready',
                payload: publicationPayload,
            })
        );
    });

    it('routes W3C projection envelopes to the W3C approver', async () => {
        const signal = publicationEnvelope('/w3c/signing/request', {
            d: 'w3c-request-id',
            aid: 'Eaid',
            name: 'holder',
        });
        const response = new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode(
                            `data: ${JSON.stringify(signal)}\n\n`
                        )
                    );
                    controller.close();
                },
            })
        );
        const client = {
            signals: () => ({
                stream: vi.fn(async () => response),
                verifyReplyEnvelope: vi.fn(() => true),
            }),
        } as unknown as SignifyClient;
        const approver = {
            handleEnvelope: vi.fn(async () => ({
                outcome: 'submitted',
            })),
        } as unknown as DidWebsAutoApprover;
        const w3cApprover = {
            handleEnvelope: vi.fn(async () => ({
                outcome: 'submitted',
            })),
        } as unknown as W3CProjectionAutoApprover;

        await consumeDidWebsSignalStream({
            client,
            approver,
            w3cApprover,
            signal: new AbortController().signal,
        });

        expect(approver.handleEnvelope).not.toHaveBeenCalled();
        expect(w3cApprover.handleEnvelope).toHaveBeenCalledWith(signal);
    });

    it('polls pending requests and reconciles completion through one approver', async () => {
        const approver = {
            pollOnce: vi.fn(async () => [
                { outcome: 'submitted' } satisfies DidWebsAutoApproveResult,
            ]),
            reconcile: vi.fn(async () => [
                {
                    id: 'request-id',
                    aid: 'Eaid',
                    action: 'create_registry',
                    status: 'complete',
                    updated: '2026-04-29T00:00:00.000Z',
                },
            ]),
        } as unknown as DidWebsAutoApprover;

        await expect(approvePendingDidWebsRequests(approver)).resolves.toEqual({
            pollResults: [{ outcome: 'submitted' }],
            reconciled: 1,
        });
        expect(approver.pollOnce).toHaveBeenCalledTimes(1);
        expect(approver.reconcile).toHaveBeenCalledTimes(1);
    });

    it('polls pending W3C projection requests and reconciles completion', async () => {
        const approver = {
            pollOnce: vi.fn(async () => [
                {
                    outcome: 'submitted',
                } satisfies W3CProjectionAutoApproveResult,
            ]),
            reconcile: vi.fn(async () => [
                {
                    id: 'w3c-request-id',
                    aid: 'Eaid',
                    kind: 'vc_jwt',
                    status: 'complete',
                    updated: '2026-04-29T00:00:00.000Z',
                },
            ]),
        } as unknown as W3CProjectionAutoApprover;

        await expect(
            approvePendingW3CProjectionRequests(approver)
        ).resolves.toEqual({
            pollResults: [{ outcome: 'submitted' }],
            reconciled: 1,
        });
        expect(approver.pollOnce).toHaveBeenCalledTimes(1);
        expect(approver.reconcile).toHaveBeenCalledTimes(1);
    });

    it('continues W3C polling when did:webs polling fails', async () => {
        const didWebsApprover = {
            pollOnce: vi.fn(async () => {
                throw new Error('did:webs polling failed');
            }),
            reconcile: vi.fn(),
        } as unknown as DidWebsAutoApprover;
        const w3cApprover = {
            pollOnce: vi.fn(async () => [
                {
                    outcome: 'submitted',
                } satisfies W3CProjectionAutoApproveResult,
            ]),
            reconcile: vi.fn(async () => []),
        } as unknown as W3CProjectionAutoApprover;

        const results = await approvePendingDidWebsAndW3CRequests({
            approver: didWebsApprover,
            w3cApprover,
        });

        expect(results.didWebs.ok).toBe(false);
        expect(results.w3c).toEqual({
            ok: true,
            value: {
                pollResults: [{ outcome: 'submitted' }],
                reconciled: 0,
            },
        });
        expect(w3cApprover.pollOnce).toHaveBeenCalledTimes(1);
        expect(w3cApprover.reconcile).toHaveBeenCalledTimes(1);
    });
});
