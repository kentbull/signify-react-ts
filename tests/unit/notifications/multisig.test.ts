import { describe, expect, it } from 'vitest';
import {
    MULTISIG_ICP_ROUTE,
    MULTISIG_IXN_ROUTE,
} from '../../../src/services/multisig.service';
import {
    loadedAt,
    makeClient,
    multisigIcpExchange,
    runListNotifications,
} from './helpers';

describe('multisig notification hydration', () => {
    it('hydrates multisig inception requests as actionable for local members', async () => {
        const groupRequest = [
            {
                groupName: 'team',
                sender: 'Esender',
                exn: {
                    d: 'Egroup-exn',
                    i: 'Esender',
                    dt: loadedAt,
                    r: MULTISIG_ICP_ROUTE,
                    a: {
                        gid: 'Egroup',
                        smids: ['Erecipient', 'Esender'],
                        rmids: ['Erecipient', 'Esender'],
                    },
                    e: {
                        icp: {
                            d: 'Eicp',
                        },
                    },
                },
            },
        ];
        const { client, groups } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: MULTISIG_ICP_ROUTE, d: 'Egroup-exn' },
                    },
                ],
            },
            groupRequest,
        });

        const snapshot = await runListNotifications(client, [], ['Erecipient']);

        expect(groups.getRequest).toHaveBeenCalledWith('Egroup-exn');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'note-1',
                status: 'unread',
                multisigRequest: expect.objectContaining({
                    route: MULTISIG_ICP_ROUTE,
                    groupAid: 'Egroup',
                    groupAlias: null,
                    status: 'actionable',
                    signingMemberAids: ['Erecipient', 'Esender'],
                }),
            }),
        ]);
    });

    it('hydrates multisig interaction requests by local participant status', async () => {
        const groupRequest = [
            {
                groupName: 'team',
                sender: 'Esender',
                exn: {
                    d: 'Eixn-exn',
                    i: 'Esender',
                    dt: loadedAt,
                    r: MULTISIG_IXN_ROUTE,
                    a: {
                        gid: 'Egroup',
                        smids: ['Erecipient', 'Esender'],
                        rmids: ['Erecipient', 'Esender'],
                    },
                    e: {
                        ixn: {
                            d: 'Eixn',
                        },
                    },
                },
            },
        ];
        const rawNotifications = {
            notes: [
                {
                    i: 'note-ixn',
                    dt: loadedAt,
                    r: false,
                    a: { r: MULTISIG_IXN_ROUTE, d: 'Eixn-exn' },
                },
            ],
        };
        const { client } = makeClient({
            rawNotifications,
            groupRequest,
        });
        const participantSnapshot = await runListNotifications(
            client,
            [],
            ['Erecipient']
        );

        expect(participantSnapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'note-ixn',
                status: 'unread',
                multisigRequest: expect.objectContaining({
                    route: MULTISIG_IXN_ROUTE,
                    groupAid: 'Egroup',
                    groupAlias: 'team',
                    status: 'actionable',
                    embeddedEventType: 'ixn',
                    embeddedEventSaid: 'Eixn',
                }),
            }),
        ]);

        const nonParticipant = makeClient({
            rawNotifications,
            groupRequest,
        });
        const nonParticipantSnapshot = await runListNotifications(
            nonParticipant.client,
            [],
            ['Eoutsider']
        );

        expect(nonParticipantSnapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'note-ixn',
                read: true,
                status: 'processed',
                multisigRequest: expect.objectContaining({
                    route: MULTISIG_IXN_ROUTE,
                    status: 'notForThisWallet',
                }),
            }),
        ]);
        expect(nonParticipant.notifications.mark).toHaveBeenCalledWith(
            'note-ixn'
        );
    });

    it('hydrates synthetic multisig invitations from exchange query', async () => {
        const leadExchange = multisigIcpExchange('Elead', 'Eicp-lead');
        const { client, groups } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [leadExchange],
            groupRequest: [
                {
                    groupName: 'team',
                    sender: 'Elead',
                    exn: leadExchange.exn,
                },
            ],
        });

        const snapshot = await runListNotifications(
            client,
            [],
            ['Efollower']
        );

        expect(groups.getRequest).toHaveBeenCalledWith('Eicp-lead');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'exchange:Eicp-lead',
                route: MULTISIG_ICP_ROUTE,
                status: 'unread',
                message: 'Group invitation',
                multisigRequest: expect.objectContaining({
                    route: MULTISIG_ICP_ROUTE,
                    groupAlias: null,
                    status: 'actionable',
                    progress: {
                        groupAid: 'Egroup',
                        route: MULTISIG_ICP_ROUTE,
                        expectedMemberAids: [
                            'Elead',
                            'Efollower',
                            'Ethird',
                        ],
                        respondedMemberAids: ['Elead'],
                        waitingMemberAids: ['Efollower', 'Ethird'],
                        completed: 1,
                        total: 3,
                    },
                }),
            }),
        ]);
    });

    it('dedupes multisig exchange progress and marks local responses handled', async () => {
        const leadExchange = multisigIcpExchange('Elead', 'Eicp-lead');
        const followerExchange = multisigIcpExchange(
            'Efollower',
            'Eicp-follower'
        );
        const { client } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [leadExchange, followerExchange],
            groupRequest: [
                {
                    groupName: 'team',
                    sender: 'Elead',
                    exn: leadExchange.exn,
                },
            ],
        });

        const snapshot = await runListNotifications(client, [], ['Elead']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'exchange:Eicp-lead',
                status: 'processed',
                message: 'Group invitation handled.',
                multisigRequest: expect.objectContaining({
                    status: 'approved',
                    progress: expect.objectContaining({
                        respondedMemberAids: ['Elead', 'Efollower'],
                        waitingMemberAids: ['Ethird'],
                        completed: 2,
                        total: 3,
                    }),
                }),
            }),
        ]);
    });
});

