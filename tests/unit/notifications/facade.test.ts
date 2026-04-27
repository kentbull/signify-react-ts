import { describe, expect, it } from 'vitest';
import { challengeExchange, contact, loadedAt, makeClient, runListNotifications } from './helpers';

describe('notification service facade orchestration', () => {
    it('filters tombstoned synthetic challenge request exchanges', async () => {
        const { client } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [challengeExchange],
        });

        const snapshot = await runListNotifications(
            client,
            [contact],
            [],
            ['Eexn']
        );

        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('filters KERIA notifications with tombstoned anchors before hydration', async () => {
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

        const snapshot = await runListNotifications(
            client,
            [contact],
            [],
            ['Eexn']
        );

        expect(exchanges.get).not.toHaveBeenCalled();
        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('filters hydrated KERIA challenge requests with tombstoned EXN SAIDs', async () => {
        const { client, exchanges } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: '/exn', d: 'Eanchor' },
                    },
                ],
            },
            exchange: challengeExchange,
        });

        const snapshot = await runListNotifications(
            client,
            [contact],
            [],
            ['Eexn']
        );

        expect(exchanges.get).toHaveBeenCalledWith('Eanchor');
        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });
});

