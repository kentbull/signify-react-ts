import type { SignifyClient } from 'signify-ts';
import { vi } from 'vitest';
import { createAppRuntime } from '../../../src/app/runtime';
import { CHALLENGE_REQUEST_ROUTE } from '../../../src/services/challenges.service';
import { listNotificationsService } from '../../../src/services/notifications.service';
import { MULTISIG_ICP_ROUTE } from '../../../src/services/multisig.service';
import type { ContactRecord } from '../../../src/state/contacts.slice';

export const loadedAt = '2026-04-22T00:00:00.000Z';

export const contact = {
    id: 'Esender',
    alias: 'Alice',
    aid: 'Esender',
    oobi: null,
    endpoints: [],
    wellKnowns: [],
    componentTags: [],
    challengeCount: 0,
    authenticatedChallengeCount: 0,
    resolutionStatus: 'resolved',
    error: null,
    updatedAt: loadedAt,
} satisfies ContactRecord;

export const challengeExchange = {
    exn: {
        d: 'Eexn',
        i: 'Esender',
        rp: 'Erecipient',
        dt: loadedAt,
        r: CHALLENGE_REQUEST_ROUTE,
        a: {
            i: 'Erecipient',
            challengeId: 'challenge-1',
            wordsHash: 'hash-one',
            strength: 128,
        },
    },
};

export const multisigIcpExchange = (senderAid: string, exnSaid: string) => ({
    exn: {
        d: exnSaid,
        i: senderAid,
        dt: loadedAt,
        r: MULTISIG_ICP_ROUTE,
        a: {
            gid: 'Egroup',
            smids: ['Elead', 'Efollower', 'Ethird'],
            rmids: ['Elead', 'Efollower', 'Ethird'],
        },
        e: {
            icp: {
                d: 'Eicp',
                kt: ['1/3', '1/3', '1/3'],
                nt: ['1/3', '1/3', '1/3'],
            },
        },
    },
});

export const makeClient = ({
    rawNotifications,
    exchange = challengeExchange,
    queryExchanges = [],
    groupRequest = [],
}: {
    rawNotifications: unknown;
    exchange?: unknown;
    queryExchanges?: unknown[];
    groupRequest?: unknown[];
}) => {
    const notifications = {
        list: vi.fn(async () => rawNotifications),
        mark: vi.fn(async () => ''),
        delete: vi.fn(async () => undefined),
    };
    const exchanges = {
        get: vi.fn(async () => exchange),
    };
    const groups = {
        getRequest: vi.fn(async () => groupRequest),
    };
    const client = {
        notifications: () => notifications,
        exchanges: () => exchanges,
        groups: () => groups,
        fetch: vi.fn(async () => ({
            json: async () => queryExchanges,
        })),
    } as unknown as SignifyClient;

    return { client, notifications, exchanges, groups };
};

export const runListNotifications = async (
    client: SignifyClient,
    contacts: readonly ContactRecord[] = [],
    localAids: readonly string[] = [],
    tombstonedExnSaids: readonly string[] = []
) => {
    const runtime = createAppRuntime({ storage: null });
    try {
        return await runtime.runWorkflow(
            () =>
                listNotificationsService({
                    client,
                    contacts,
                    localAids,
                    tombstonedExnSaids,
                }),
            { scope: 'app', track: false }
        );
    } finally {
        await runtime.destroy();
    }
};

