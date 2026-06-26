import { describe, expect, it } from 'vitest';
import {
    CHALLENGE_REQUEST_ROUTE,
    CHALLENGE_TOPIC,
} from '../../../src/services/challenges.service';
import {
    challengeRequestFromExchange,
    notificationRecordsFromResponse,
} from '../../../src/services/notifications.service';
import {
    challengeExchange,
    contact,
    loadedAt,
    makeClient,
    runListNotifications,
} from './helpers';

describe('challenge notification hydration', () => {
    it('parses challenge request EXNs without raw challenge words', () => {
        const [notification] = notificationRecordsFromResponse(
            [
                {
                    i: 'note-1',
                    dt: loadedAt,
                    r: false,
                    a: { r: CHALLENGE_REQUEST_ROUTE, d: 'Eexn' },
                },
            ],
            loadedAt
        );

        expect(
            challengeRequestFromExchange({
                notification,
                exchange: challengeExchange,
                senderAlias: 'Alice',
                status: 'actionable',
                loadedAt,
            })
        ).toEqual({
            notificationId: 'note-1',
            exnSaid: 'Eexn',
            senderAid: 'Esender',
            senderAlias: 'Alice',
            recipientAid: 'Erecipient',
            challengeId: 'challenge-1',
            wordsHash: 'hash-one',
            strength: 128,
            createdAt: loadedAt,
            status: 'actionable',
        });
        expect(JSON.stringify(challengeExchange)).not.toContain('"words":');
        expect(CHALLENGE_TOPIC).toBe('challenge');
    });

    it('hydrates known challenge request senders as actionable', async () => {
        const { client, exchanges } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: '/exn', d: 'Eexn' },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [contact]);

        expect(exchanges.get).toHaveBeenCalledWith('Eexn');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'note-1',
                status: 'unread',
                challengeRequest: expect.objectContaining({
                    senderAlias: 'Alice',
                    status: 'actionable',
                    wordsHash: 'hash-one',
                }),
            }),
        ]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('hydrates challenge requests from exchange query when no KERIA note exists', async () => {
        const { client, exchanges } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [challengeExchange],
        });

        const snapshot = await runListNotifications(client, [contact]);

        expect(exchanges.get).not.toHaveBeenCalled();
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'challenge-request:Eexn',
                route: CHALLENGE_REQUEST_ROUTE,
                status: 'unread',
                challengeRequest: expect.objectContaining({
                    notificationId: 'challenge-request:Eexn',
                    senderAlias: 'Alice',
                    status: 'actionable',
                }),
            }),
        ]);
    });

    it('ignores locally-authored challenge request exchanges', async () => {
        const outboundExchange = {
            exn: {
                d: 'Eoutbound',
                i: 'Erecipient',
                rp: 'Esender',
                dt: loadedAt,
                r: CHALLENGE_REQUEST_ROUTE,
                a: {
                    i: 'Esender',
                    challengeId: 'challenge-outbound',
                    wordsHash: 'hash-outbound',
                    strength: 128,
                },
            },
        };
        const { client } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [outboundExchange],
        });

        const snapshot = await runListNotifications(
            client,
            [contact],
            ['Erecipient']
        );

        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('does not warn for outbound challenge requests before local identifiers are loaded', async () => {
        const outboundExchange = {
            exn: {
                d: 'Eoutbound',
                i: 'Erecipient',
                rp: 'Esender',
                dt: loadedAt,
                r: CHALLENGE_REQUEST_ROUTE,
                a: {
                    i: 'Esender',
                    challengeId: 'challenge-outbound',
                    wordsHash: 'hash-outbound',
                    strength: 128,
                },
            },
        };
        const { client } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [outboundExchange],
        });

        const snapshot = await runListNotifications(client, [contact]);

        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('marks unknown challenge request senders read and reports one notice', async () => {
        const { client, notifications } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: '/exn', d: 'Eexn' },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, []);

        expect(notifications.mark).toHaveBeenCalledWith('note-1');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'note-1',
                read: true,
                status: 'processed',
                challengeRequest: expect.objectContaining({
                    senderAid: 'Esender',
                    status: 'senderUnknown',
                }),
            }),
        ]);
        expect(snapshot.unknownChallengeSenders).toEqual([
            {
                notificationId: 'note-1',
                exnSaid: 'Eexn',
                senderAid: 'Esender',
                createdAt: loadedAt,
            },
        ]);
    });
});

