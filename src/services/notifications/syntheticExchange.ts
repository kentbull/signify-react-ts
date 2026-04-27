import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import type { ContactRecord } from '../../domain/contacts/contactTypes';
import { callPromise } from '../../effects/promise';
import type { ChallengeRequestNotification } from '../../state/notifications.slice';
import type { NotificationRecord } from '../../state/notifications.slice';
import { CHALLENGE_REQUEST_ROUTE } from '../challenges.service';
import {
    contactForAid,
    exchangeExn,
    exchangeGroupAid,
    exchangeRecipientAid,
    exchangeRoute,
    exchangeSaid,
    exchangeSenderAid,
    stringValue,
} from './base';
import {
    challengeRequestFromExchange,
    isOutboundOrUnrelatedChallengeRequest,
} from './challenge';
import {
    hydrateMultisigRequestNotification,
    isMultisigRequestRoute,
    MULTISIG_NOTIFICATION_ROUTE_LIST,
    multisigProgressKey,
    multisigRequestLabel,
} from './multisig';
import {
    syntheticChallengeNotificationId,
    syntheticExchangeNotificationId,
} from './syntheticIds';
import type { ChallengeHydrationResult } from './types';

const challengeRequestExchangesFromResponse = (raw: unknown): unknown[] =>
    Array.isArray(raw)
        ? raw.filter((item) => {
              try {
                  return exchangeRoute(item) === CHALLENGE_REQUEST_ROUTE;
              } catch {
                  return false;
              }
          })
        : [];

const multisigRequestExchangesFromResponse = (
    raw: unknown,
    requestedRoute?: string
): unknown[] =>
    Array.isArray(raw)
        ? raw.filter((item) => {
              try {
                  const route = exchangeRoute(item);
                  return requestedRoute === undefined
                      ? isMultisigRequestRoute(route)
                      : route === requestedRoute;
              } catch {
                  return false;
              }
          })
        : [];

function* listChallengeRequestExchanges({
    client,
}: {
    client: SignifyClient;
}): EffectionOperation<unknown[]> {
    const raw: unknown = yield* callPromise(() =>
        client
            .fetch('/exchanges/query', 'POST', {
                filter: {
                    '-r': CHALLENGE_REQUEST_ROUTE,
                },
                limit: 50,
            })
            .then((response) => response.json())
    );

    return challengeRequestExchangesFromResponse(raw);
}

export function* listMultisigRequestExchanges({
    client,
}: {
    client: SignifyClient;
}): EffectionOperation<unknown[]> {
    const exchanges: unknown[] = [];
    const seen = new Set<string>();

    for (const route of MULTISIG_NOTIFICATION_ROUTE_LIST) {
        try {
            const raw: unknown = yield* callPromise(() =>
                client
                    .fetch('/exchanges/query', 'POST', {
                        filter: {
                            '-r': route,
                        },
                        limit: 100,
                    })
                    .then((response) => response.json())
            );
            for (const exchange of multisigRequestExchangesFromResponse(
                raw,
                route
            )) {
                const said = exchangeSaid(exchange);
                if (said === null || seen.has(said)) {
                    continue;
                }

                seen.add(said);
                exchanges.push(exchange);
            }
        } catch {
            // Exchange query is a fallback; KERIA notifications remain authoritative.
        }
    }

    return exchanges;
}

const shouldReplaceSyntheticMultisigExchange = ({
    current,
    candidate,
    localAids,
}: {
    current: unknown;
    candidate: unknown;
    localAids: ReadonlySet<string>;
}): boolean => {
    const currentSender = exchangeSenderAid(current);
    const candidateSender = exchangeSenderAid(candidate);
    const currentIsLocal =
        currentSender !== null && localAids.has(currentSender);
    const candidateIsLocal =
        candidateSender !== null && localAids.has(candidateSender);

    return candidateIsLocal && !currentIsLocal;
};

const syntheticMultisigProposalExchanges = (
    exchanges: readonly unknown[],
    localAids: ReadonlySet<string>
): unknown[] => {
    const proposals = new Map<string, unknown>();

    for (const exchange of exchanges) {
        try {
            const route = exchangeRoute(exchange);
            if (!isMultisigRequestRoute(route)) {
                continue;
            }

            const key = multisigProgressKey(route, exchangeGroupAid(exchange));
            const current = proposals.get(key);
            if (
                current === undefined ||
                shouldReplaceSyntheticMultisigExchange({
                    current,
                    candidate: exchange,
                    localAids,
                })
            ) {
                proposals.set(key, exchange);
            }
        } catch {
            continue;
        }
    }

    return [...proposals.values()];
};

/**
 * Create a notification shell for a challenge EXN that has no KERIA note.
 */
const syntheticNotificationFromExchange = (
    exchange: unknown,
    loadedAt: string
): NotificationRecord | null => {
    const exn = exchangeExn(exchange);
    const exnSaid = stringValue(exn.d);
    if (exnSaid === null) {
        return null;
    }

    const dt = stringValue(exn.dt) ?? loadedAt;
    return {
        id: syntheticChallengeNotificationId(exnSaid),
        dt,
        read: false,
        route: CHALLENGE_REQUEST_ROUTE,
        anchorSaid: exnSaid,
        status: 'unread',
        message: null,
        challengeRequest: null,
        updatedAt: dt,
    };
};

const syntheticMultisigNotificationFromExchange = (
    exchange: unknown,
    loadedAt: string
): NotificationRecord | null => {
    const exn = exchangeExn(exchange);
    const exnSaid = exchangeSaid(exchange);
    const route = exchangeRoute(exchange);
    if (exnSaid === null || !isMultisigRequestRoute(route)) {
        return null;
    }

    return {
        id: syntheticExchangeNotificationId(exnSaid),
        dt: stringValue(exn.dt) ?? loadedAt,
        read: false,
        route,
        anchorSaid: exnSaid,
        status: 'unread',
        message: multisigRequestLabel(route),
        updatedAt: loadedAt,
    };
};

export function* syntheticChallengeRequestNotifications({
    client,
    contacts,
    localAids,
    tombstonedExnSaids,
    loadedAt,
    existingExnSaids,
    respondedChallengeIds,
    respondedWordsHashes,
}: {
    client: SignifyClient;
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    tombstonedExnSaids: ReadonlySet<string>;
    loadedAt: string;
    existingExnSaids: ReadonlySet<string>;
    respondedChallengeIds: ReadonlySet<string>;
    respondedWordsHashes: ReadonlySet<string>;
}): EffectionOperation<ChallengeHydrationResult> {
    const exchanges = yield* listChallengeRequestExchanges({ client });
    const notifications: NotificationRecord[] = [];
    const unknownChallengeSenders: ChallengeHydrationResult['unknownChallengeSenders'] =
        [];

    for (const exchange of exchanges) {
        const exnSaid = exchangeSaid(exchange);
        if (
            exnSaid === null ||
            existingExnSaids.has(exnSaid) ||
            tombstonedExnSaids.has(exnSaid)
        ) {
            continue;
        }

        const notification = syntheticNotificationFromExchange(
            exchange,
            loadedAt
        );
        if (notification === null) {
            continue;
        }

        try {
            const provisional = challengeRequestFromExchange({
                notification,
                exchange,
                senderAlias: 'Unknown sender',
                status: 'actionable',
                loadedAt,
            });
            const recipientAid = exchangeRecipientAid(exchange);
            const sender = contactForAid(contacts, provisional.senderAid);
            if (
                isOutboundOrUnrelatedChallengeRequest({
                    contacts,
                    localAids,
                    recipientAid,
                    sender,
                    senderAid: provisional.senderAid,
                })
            ) {
                continue;
            }

            if (sender === null) {
                const challengeRequest = {
                    ...provisional,
                    status: 'senderUnknown' as const,
                };
                notifications.push({
                    ...notification,
                    read: true,
                    status: 'processed',
                    message:
                        'Challenge request sender is not in contacts; synthetic notification was closed.',
                    challengeRequest,
                });
                unknownChallengeSenders.push({
                    notificationId: notification.id,
                    exnSaid: challengeRequest.exnSaid,
                    senderAid: challengeRequest.senderAid,
                    createdAt: challengeRequest.createdAt,
                });
                continue;
            }

            // Synthetic requests do not have KERIA read state, so local
            // challenge records decide whether the user already responded.
            const responded =
                respondedChallengeIds.has(provisional.challengeId) ||
                respondedWordsHashes.has(provisional.wordsHash);
            const challengeRequest = {
                ...provisional,
                senderAlias: sender.alias,
                status: responded ? 'responded' : 'actionable',
            } satisfies ChallengeRequestNotification;
            notifications.push({
                ...notification,
                read: responded,
                status: responded ? 'processed' : 'unread',
                message: `Challenge request from ${sender.alias}`,
                challengeRequest,
            });
        } catch (error) {
            notifications.push({
                ...notification,
                status: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Unable to hydrate challenge request exchange.',
            });
        }
    }

    return { notifications, unknownChallengeSenders };
}

export function* syntheticMultisigRequestNotifications({
    client,
    exchanges,
    localAids,
    tombstonedExnSaids,
    loadedAt,
    existingExnSaids,
    responseProgress,
}: {
    client: SignifyClient;
    exchanges: readonly unknown[];
    localAids: ReadonlySet<string>;
    tombstonedExnSaids: ReadonlySet<string>;
    loadedAt: string;
    existingExnSaids: ReadonlySet<string>;
    responseProgress: ReadonlyMap<string, ReadonlySet<string>>;
}): EffectionOperation<NotificationRecord[]> {
    const notifications: NotificationRecord[] = [];

    for (const exchange of syntheticMultisigProposalExchanges(
        exchanges,
        localAids
    )) {
        const exnSaid = exchangeSaid(exchange);
        if (
            exnSaid === null ||
            existingExnSaids.has(exnSaid) ||
            tombstonedExnSaids.has(exnSaid)
        ) {
            continue;
        }

        const shell = syntheticMultisigNotificationFromExchange(
            exchange,
            loadedAt
        );
        if (shell === null) {
            continue;
        }

        const hydrated = yield* hydrateMultisigRequestNotification({
            client,
            notification: shell,
            localAids,
            loadedAt,
            responseProgress,
        });
        if (hydrated.multisigRequest?.status === 'notForThisWallet') {
            continue;
        }
        notifications.push(hydrated);
    }

    return notifications;
}

