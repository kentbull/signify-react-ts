import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import type { ContactRecord } from '../../domain/contacts/contactTypes';
import { callPromise } from '../../effects/promise';
import type {
    ChallengeRequestNotification,
    ChallengeRequestNotificationStatus,
    NotificationRecord,
} from '../../state/notifications.slice';
import { CHALLENGE_REQUEST_ROUTE } from '../challenges.service';
import {
    contactForAid,
    exchangeExn,
    exchangeRecipientAid,
    exchangeRoute,
    isRecord,
    numberValue,
    stringValue,
} from './base';
import type {
    ChallengeHydrationResult,
    UnknownChallengeSenderNotice,
} from './types';

export const isOutboundOrUnrelatedChallengeRequest = ({
    contacts,
    localAids,
    recipientAid,
    sender,
    senderAid,
}: {
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    recipientAid: string | null;
    sender: ContactRecord | null;
    senderAid: string;
}): boolean => {
    if (localAids.has(senderAid)) {
        return true;
    }

    if (localAids.size > 0) {
        return recipientAid === null || !localAids.has(recipientAid);
    }

    return (
        sender === null &&
        recipientAid !== null &&
        contactForAid(contacts, recipientAid) !== null
    );
};

/**
 * Validate and extract challenge-request metadata from a KERIA exchange.
 */
export const challengeRequestFromExchange = ({
    notification,
    exchange,
    senderAlias,
    status,
    loadedAt,
}: {
    notification: NotificationRecord;
    exchange: unknown;
    senderAlias: string;
    status: ChallengeRequestNotificationStatus;
    loadedAt: string;
}): ChallengeRequestNotification => {
    const exn = exchangeExn(exchange);
    const route = stringValue(exn.r);
    if (route !== CHALLENGE_REQUEST_ROUTE) {
        throw new Error(
            `Expected ${CHALLENGE_REQUEST_ROUTE} EXN, received ${route ?? 'unknown route'}.`
        );
    }

    const attrs = isRecord(exn.a) ? exn.a : {};
    const exnSaid = stringValue(exn.d) ?? notification.anchorSaid;
    const senderAid = stringValue(exn.i);
    const recipientAid = stringValue(exn.rp) ?? stringValue(attrs.i);
    const challengeId = stringValue(attrs.challengeId);
    const wordsHash = stringValue(attrs.wordsHash);
    const strength = numberValue(attrs.strength);
    const createdAt =
        stringValue(exn.dt) ??
        notification.dt ??
        notification.updatedAt ??
        loadedAt;

    if (exnSaid === null) {
        throw new Error('Challenge request EXN is missing its SAID.');
    }

    if (senderAid === null) {
        throw new Error('Challenge request EXN is missing its sender AID.');
    }

    if (challengeId === null || wordsHash === null || strength === null) {
        throw new Error('Challenge request EXN is missing challenge metadata.');
    }

    return {
        notificationId: notification.id,
        exnSaid,
        senderAid,
        senderAlias,
        recipientAid,
        challengeId,
        wordsHash,
        strength,
        createdAt,
        status,
    };
};

function* hydrateChallengeRequestNotification({
    client,
    notification,
    contacts,
    localAids,
    loadedAt,
}: {
    client: SignifyClient;
    notification: NotificationRecord;
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<{
    notification: NotificationRecord;
    unknownChallengeSender: UnknownChallengeSenderNotice | null;
}> {
    const canHydrate =
        notification.route === CHALLENGE_REQUEST_ROUTE ||
        (notification.anchorSaid !== null && notification.route === '/exn');
    if (!canHydrate) {
        return { notification, unknownChallengeSender: null };
    }

    if (notification.anchorSaid === null) {
        return {
            notification: {
                ...notification,
                status: 'error',
                message:
                    'Challenge request notification is missing its EXN SAID.',
            },
            unknownChallengeSender: null,
        };
    }

    try {
        const anchorSaid = notification.anchorSaid;
        const exchange = yield* callPromise(() =>
            client.exchanges().get(anchorSaid)
        );
        if (exchangeRoute(exchange) !== CHALLENGE_REQUEST_ROUTE) {
            return notification.route === CHALLENGE_REQUEST_ROUTE
                ? {
                      notification: {
                          ...notification,
                          status: 'error',
                          message:
                              'Challenge request notification referenced a non-challenge EXN.',
                      },
                      unknownChallengeSender: null,
                  }
                : { notification, unknownChallengeSender: null };
        }

        // Hydrate first with a placeholder alias; contact inventory below is
        // the source of truth for whether this sender is known and actionable.
        const provisional = challengeRequestFromExchange({
            notification,
            exchange,
            senderAlias: 'Unknown sender',
            status: 'actionable',
            loadedAt,
        });
        const sender = contactForAid(contacts, provisional.senderAid);
        const recipientAid = exchangeRecipientAid(exchange);
        if (
            isOutboundOrUnrelatedChallengeRequest({
                contacts,
                localAids,
                recipientAid,
                sender,
                senderAid: provisional.senderAid,
            })
        ) {
            if (!notification.read) {
                yield* callPromise(() =>
                    client.notifications().mark(notification.id)
                );
            }

            return {
                notification: {
                    ...notification,
                    read: true,
                    status: 'processed',
                    message:
                        'Challenge request was ignored because it is not inbound to this wallet.',
                    challengeRequest: null,
                },
                unknownChallengeSender: null,
            };
        }

        if (sender === null) {
            if (!notification.read) {
                yield* callPromise(() =>
                    client.notifications().mark(notification.id)
                );
            }

            // Unknown senders are marked read in KERIA so the protocol inbox
            // does not keep resurfacing an item the app cannot safely answer.
            const challengeRequest = {
                ...provisional,
                status: 'senderUnknown' as const,
            };
            return {
                notification: {
                    ...notification,
                    read: true,
                    status: 'processed',
                    message:
                        'Challenge request sender is not in contacts; notification was marked read.',
                    challengeRequest,
                },
                unknownChallengeSender: notification.read
                    ? null
                    : {
                          notificationId: notification.id,
                          exnSaid: challengeRequest.exnSaid,
                          senderAid: challengeRequest.senderAid,
                          createdAt: challengeRequest.createdAt,
                      },
            };
        }

        const challengeRequest = {
            ...provisional,
            senderAlias: sender.alias,
            status: notification.read ? 'responded' : 'actionable',
        } satisfies ChallengeRequestNotification;

        return {
            notification: {
                ...notification,
                status: notification.read ? 'processed' : 'unread',
                message:
                    notification.message ??
                    `Challenge request from ${sender.alias}`,
                challengeRequest,
            },
            unknownChallengeSender: null,
        };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Unable to hydrate challenge request notification.';
        return {
            notification: {
                ...notification,
                status: 'error',
                message,
                challengeRequest: null,
            },
            unknownChallengeSender: null,
        };
    }
}

export function* hydrateChallengeRequestNotifications({
    client,
    notifications,
    contacts,
    localAids,
    tombstonedExnSaids,
    loadedAt,
}: {
    client: SignifyClient;
    notifications: NotificationRecord[];
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    tombstonedExnSaids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<ChallengeHydrationResult> {
    const hydrated: NotificationRecord[] = [];
    const unknownChallengeSenders: UnknownChallengeSenderNotice[] = [];

    for (const notification of notifications) {
        const result = yield* hydrateChallengeRequestNotification({
            client,
            notification,
            contacts,
            localAids,
            loadedAt,
        });
        const exnSaid =
            result.notification.challengeRequest?.exnSaid ??
            result.notification.anchorSaid;
        // Tombstones are app-local deletions for exchange-backed items that
        // may still be discoverable through `/exchanges/query`.
        if (exnSaid !== null && tombstonedExnSaids.has(exnSaid)) {
            continue;
        }

        hydrated.push(result.notification);
        if (result.unknownChallengeSender !== null) {
            unknownChallengeSenders.push(result.unknownChallengeSender);
        }
    }

    return { notifications: hydrated, unknownChallengeSenders };
}
