import { describe, expect, it } from 'vitest';
import { CHALLENGE_REQUEST_ROUTE } from '../../../src/services/challenges.service';
import {
    notificationResponseProjectionFromNotes,
    parseKeriaNotificationResponse,
} from '../../../src/services/notifications/base';
import { notificationRecordsFromResponse } from '../../../src/services/notifications.service';
import { loadedAt } from './helpers';

describe('base notification projection', () => {
    it('normalizes Signify notification responses that wrap notes', () => {
        expect(
            notificationRecordsFromResponse(
                {
                    notes: [
                        {
                            i: 'note-1',
                            dt: loadedAt,
                            r: false,
                            a: {
                                r: CHALLENGE_REQUEST_ROUTE,
                                d: 'Eexn',
                                m: 'message',
                            },
                        },
                    ],
                },
                loadedAt
            )
        ).toEqual([
            expect.objectContaining({
                id: 'note-1',
                read: false,
                route: CHALLENGE_REQUEST_ROUTE,
                anchorSaid: 'Eexn',
                status: 'unread',
                message: 'message',
            }),
        ]);
    });

    it('normalizes bare notification arrays', () => {
        expect(
            notificationRecordsFromResponse(
                [
                    {
                        i: 'note-2',
                        dt: loadedAt,
                        r: true,
                        a: {
                            r: '/exn',
                            d: 'Eanchor',
                        },
                    },
                ],
                loadedAt
            )
        ).toEqual([
            expect.objectContaining({
                id: 'note-2',
                read: true,
                route: '/exn',
                anchorSaid: 'Eanchor',
                status: 'processed',
            }),
        ]);
    });

    it('skips malformed notification entries before projection', () => {
        expect(
            parseKeriaNotificationResponse({
                notes: [
                    null,
                    {},
                    { i: '' },
                    { i: 'note-3', a: { r: '/exn' } },
                ],
            })
        ).toEqual([
            {
                id: 'note-3',
                dt: null,
                read: false,
                attrs: { r: '/exn' },
                anchorSaid: null,
            },
        ]);
    });

    it('defaults malformed attrs to an unknown route', () => {
        const notes = parseKeriaNotificationResponse([
            {
                i: 'note-4',
                dt: loadedAt,
                r: false,
                d: 'Efallback',
                a: 'not-attrs',
            },
        ]);

        expect(
            notificationResponseProjectionFromNotes(notes, loadedAt)
                .notifications
        ).toEqual([
            expect.objectContaining({
                id: 'note-4',
                route: 'unknown',
                anchorSaid: 'Efallback',
                message: null,
            }),
        ]);
    });
});
