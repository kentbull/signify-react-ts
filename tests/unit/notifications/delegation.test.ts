import { describe, expect, it } from 'vitest';
import {
    DELEGATION_REQUEST_NOTIFICATION_ROUTE,
} from '../../../src/services/notifications.service';
import { loadedAt, makeClient, runListNotifications } from './helpers';

describe('delegation notification hydration', () => {
    it('hydrates direct delegation requests as actionable for local delegators', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-note-1',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                            delpre: 'Edelegator',
                            src: 'Edelegate',
                            ked: {
                                t: 'dip',
                                i: 'Edelegate',
                                s: '0',
                                d: 'Edelegate-event',
                                di: 'Edelegator',
                            },
                        },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [], ['Edelegator']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-note-1',
                route: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                status: 'unread',
                delegationRequest: {
                    notificationId: 'delegate-note-1',
                    delegatorAid: 'Edelegator',
                    delegateAid: 'Edelegate',
                    delegateEventSaid: 'Edelegate-event',
                    sequence: '0',
                    anchor: {
                        i: 'Edelegate',
                        s: '0',
                        d: 'Edelegate-event',
                    },
                    sourceAid: 'Edelegate',
                    createdAt: loadedAt,
                    status: 'actionable',
                },
            }),
        ]);
    });

    it('does not hydrate delegation requests from generic exchange notifications', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-exn-note',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: '/exn',
                            d: 'Edelegate-exn',
                        },
                    },
                ],
            },
            exchange: {
                exn: {
                    d: 'Edelegate-exn',
                    i: 'Edelegate',
                    dt: loadedAt,
                    r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                    a: {
                        delpre: 'Edelegator',
                    },
                    e: {
                        evt: {
                            t: 'dip',
                            i: 'Edelegate',
                            s: '0',
                            d: 'Edelegate-event',
                            di: 'Edelegator',
                        },
                    },
                },
            },
        });

        const snapshot = await runListNotifications(client, [], ['Edelegator']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-exn-note',
                route: '/exn',
                status: 'unread',
                delegationRequest: null,
            }),
        ]);
    });

    it('marks delegation requests read when the delegator is not local', async () => {
        const { client, notifications } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-note-2',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                            delpre: 'Edelegator',
                            ked: {
                                t: 'drt',
                                i: 'Edelegate',
                                s: '1',
                                d: 'Edelegate-rotation',
                                di: 'Edelegator',
                            },
                        },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [], ['Eother']);

        expect(notifications.mark).toHaveBeenCalledWith('delegate-note-2');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-note-2',
                read: true,
                status: 'processed',
                delegationRequest: expect.objectContaining({
                    delegatorAid: 'Edelegator',
                    delegateAid: 'Edelegate',
                    delegateEventSaid: 'Edelegate-rotation',
                    sequence: '1',
                    status: 'notForThisWallet',
                }),
            }),
        ]);
    });

    it('reports malformed delegation request payloads', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-note-3',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                            delpre: 'Edelegator',
                        },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [], ['Edelegator']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-note-3',
                status: 'error',
                delegationRequest: null,
                message: expect.stringContaining('Delegation event'),
            }),
        ]);
    });
});

