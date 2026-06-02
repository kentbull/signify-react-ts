import { describe, expect, it, vi } from 'vitest';
import {
    approvePendingDidWebsAndW3CRequests,
    approvePendingDidWebsRequests,
    approvePendingW3CRequests,
    createHolderPresentationSigningPolicy,
    consumeDidWebsSignalStream,
    SseJsonEnvelopeParser,
} from '../../src/workflows/didwebs.op';
import { recordW3CHolderPresentationApproval } from '../../src/domain/credentials/w3cPresentationApprovals';
import { W3C_PURPOSE_HOLDER_VP_JWT } from 'signify-ts';
import type {
    DidWebsAutoApprover,
    DidWebsAutoApproveResult,
    SignifyClient,
    SignedReplyEnvelope,
    W3CAutomationResult,
    W3CEdgeAutomator,
    W3CSigningRequest,
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
    didJsonUrl: 'https://example/dws/Eaid/did.json',
    keriCesrUrl: 'https://example/dws/Eaid/keri.cesr',
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

const holderVpRequest = (
    overrides: Partial<W3CSigningRequest> = {}
): W3CSigningRequest => ({
    d: 'request-id',
    requestId: 'request-id',
    name: 'le',
    aid: 'Ele',
    purpose: W3C_PURPOSE_HOLDER_VP_JWT,
    related: 'tx-id',
    signingInputB64: 'YQ',
    encoding: 'base64url',
    verificationMethod: 'did:webs:example:dws:Ele#key-0',
    created: '2026-04-29T00:00:00.000Z',
    expires: '2030-04-29T00:10:00.000Z',
    ...overrides,
});

const policyClient = ({
    presentTxId = 'tx-id',
    signingRequestId = 'request-id',
    aud = 'https://verifier.example',
    nonce = 'nonce-1',
    sourceCredentialSaid = 'source-said',
}: {
    presentTxId?: string;
    signingRequestId?: string;
    aud?: string;
    nonce?: string;
    sourceCredentialSaid?: string;
} = {}): SignifyClient =>
    ({
        fetch: vi.fn(async (path: string) => {
            if (path.includes('/w3c/present-txs/')) {
                return Response.json({
                    presentTxId,
                    holderName: 'le',
                    holderAid: 'Ele',
                    signingRequestId,
                    aud,
                    nonce,
                    selectedCredentialId: 'held-id',
                    state: 'pending_holder_signature',
                });
            }
            if (path.includes('/w3c/credentials/held-id')) {
                return Response.json({
                    credentialId: 'held-id',
                    sourceCredentialSaid,
                });
            }
            return Response.json({});
        }),
    }) as unknown as SignifyClient;

const approveHolderPresentation = (
    overrides: Partial<
        Parameters<typeof recordW3CHolderPresentationApproval>[0]
    > = {}
): void =>
    recordW3CHolderPresentationApproval({
        presentTxId: 'tx-id',
        holderAlias: 'le',
        holderAid: 'Ele',
        credentialSaid: 'source-said',
        aud: 'https://verifier.example',
        nonce: 'nonce-1',
        expiresAt: '2030-04-29T00:10:00.000Z',
        ...overrides,
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

    it('routes W3C holder envelopes to the W3C approver', async () => {
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
        } as unknown as W3CEdgeAutomator;

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

    it('polls pending W3C holder requests and reconciles completion', async () => {
        const approver = {
            pollOnce: vi.fn(async () => [
                {
                    outcome: 'submitted',
                } satisfies W3CAutomationResult,
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
        } as unknown as W3CEdgeAutomator;

        await expect(approvePendingW3CRequests(approver)).resolves.toEqual({
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
                } satisfies W3CAutomationResult,
            ]),
            reconcile: vi.fn(async () => []),
        } as unknown as W3CEdgeAutomator;

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

    it('approves holder VP signing only for an explicitly approved transaction', async () => {
        approveHolderPresentation();
        const policy = createHolderPresentationSigningPolicy(policyClient());

        await expect(policy(holderVpRequest())).resolves.toBe(true);
    });

    it('rejects holder VP signing without a matching approval', async () => {
        const policy = createHolderPresentationSigningPolicy(policyClient());

        await expect(
            policy(holderVpRequest({ related: 'unapproved-tx' }))
        ).resolves.toContain('was not explicitly approved');
    });

    it('rejects holder VP signing when nonce binding changes', async () => {
        approveHolderPresentation({ presentTxId: 'tx-wrong-nonce' });
        const policy = createHolderPresentationSigningPolicy(
            policyClient({
                presentTxId: 'tx-wrong-nonce',
                nonce: 'other-nonce',
            })
        );

        await expect(
            policy(holderVpRequest({ related: 'tx-wrong-nonce' }))
        ).resolves.toContain('nonce does not match');
    });

    it('rejects holder VP signing when the selected credential changes', async () => {
        approveHolderPresentation({ presentTxId: 'tx-wrong-credential' });
        const policy = createHolderPresentationSigningPolicy(
            policyClient({
                presentTxId: 'tx-wrong-credential',
                sourceCredentialSaid: 'other-source-said',
            })
        );

        await expect(
            policy(holderVpRequest({ related: 'tx-wrong-credential' }))
        ).resolves.toContain('selected credential does not match');
    });
});
