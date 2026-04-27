import { describe, expect, it } from 'vitest';
import {
    IPEX_ADMIT_NOTIFICATION_ROUTE,
    IPEX_GRANT_NOTIFICATION_ROUTE,
} from '../../../src/domain/credentials/credentialMappings';
import { loadedAt, makeClient, runListNotifications } from './helpers';

const credentialGrantExchange = {
    exn: {
        d: 'Egrant',
        i: 'Eissuer',
        rp: 'Eholder',
        dt: loadedAt,
        r: '/ipex/grant',
        e: {
            acdc: {
                d: 'Ecredential',
                s: 'Eschema',
                a: {},
            },
        },
    },
};

const credentialAdmitExchange = {
    exn: {
        d: 'Eadmit',
        i: 'Eholder',
        rp: 'Eissuer',
        p: 'Egrant',
        dt: loadedAt,
        r: '/ipex/admit',
    },
};

describe('credential IPEX notification hydration', () => {
    it('hydrates actionable inbound credential grants', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'grant-note-1',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: IPEX_GRANT_NOTIFICATION_ROUTE,
                            d: 'Egrant',
                        },
                    },
                ],
            },
            exchange: credentialGrantExchange,
        });

        const snapshot = await runListNotifications(client, [], ['Eholder']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'grant-note-1',
                read: false,
                status: 'unread',
                message: 'Credential grant from Eissuer',
                credentialGrant: {
                    notificationId: 'grant-note-1',
                    grantSaid: 'Egrant',
                    issuerAid: 'Eissuer',
                    holderAid: 'Eholder',
                    credentialSaid: 'Ecredential',
                    schemaSaid: 'Eschema',
                    attributes: {},
                    createdAt: loadedAt,
                    status: 'actionable',
                },
            }),
        ]);
    });

    it('marks credential grants read when they are not for this wallet', async () => {
        const { client, notifications } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'grant-note-2',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: IPEX_GRANT_NOTIFICATION_ROUTE,
                            d: 'Egrant',
                        },
                    },
                ],
            },
            exchange: credentialGrantExchange,
        });

        const snapshot = await runListNotifications(client, [], ['Eother']);

        expect(notifications.mark).toHaveBeenCalledWith('grant-note-2');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'grant-note-2',
                read: true,
                status: 'processed',
                message: 'Credential grant is not addressed to this wallet.',
                credentialGrant: expect.objectContaining({
                    status: 'notForThisWallet',
                }),
            }),
        ]);
    });

    it('treats already-read inbound grants as admitted and processed', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'grant-note-3',
                        dt: loadedAt,
                        r: true,
                        a: {
                            r: IPEX_GRANT_NOTIFICATION_ROUTE,
                            d: 'Egrant',
                        },
                    },
                ],
            },
            exchange: credentialGrantExchange,
        });

        const snapshot = await runListNotifications(client, [], ['Eholder']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'grant-note-3',
                read: true,
                status: 'processed',
                message: 'Credential grant was already admitted.',
                credentialGrant: expect.objectContaining({
                    status: 'admitted',
                }),
            }),
        ]);
    });

    it('hydrates issuer-facing credential admit receipts', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'admit-note-1',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: IPEX_ADMIT_NOTIFICATION_ROUTE,
                            d: 'Eadmit',
                        },
                    },
                ],
            },
            exchange: credentialAdmitExchange,
        });

        const snapshot = await runListNotifications(client, [], ['Eissuer']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'admit-note-1',
                status: 'unread',
                message: 'Credential admit from Eholder',
                credentialAdmit: {
                    notificationId: 'admit-note-1',
                    admitSaid: 'Eadmit',
                    grantSaid: 'Egrant',
                    issuerAid: 'Eissuer',
                    holderAid: 'Eholder',
                    createdAt: loadedAt,
                    status: 'received',
                },
            }),
        ]);
    });
});

