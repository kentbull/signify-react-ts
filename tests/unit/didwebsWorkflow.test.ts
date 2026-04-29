import { describe, expect, it, vi } from 'vitest';
import {
    approvePendingDidWebsRequests,
    consumeDidWebsSignalStream,
    SseJsonEnvelopeParser,
} from '../../src/workflows/didwebs.op';
import type {
    DidWebsAutoApprover,
    DidWebsAutoApproveResult,
    SignifyClient,
    SignedReplyEnvelope,
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
});
