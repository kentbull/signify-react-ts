import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../../config/credentialCatalog';
import {
    credentialAdmitFromExchange,
    credentialGrantFromExchange,
    IPEX_ADMIT_NOTIFICATION_ROUTE,
    IPEX_GRANT_NOTIFICATION_ROUTE,
} from '../../domain/credentials/credentialMappings';
import { callPromise } from '../../effects/promise';
import type { NotificationRecord } from '../../state/notifications.slice';

function* hydrateCredentialIpexNotification({
    client,
    notification,
    localAids,
    loadedAt,
}: {
    client: SignifyClient;
    notification: NotificationRecord;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<NotificationRecord> {
    const isCredentialGrant =
        notification.route === IPEX_GRANT_NOTIFICATION_ROUTE;
    const isCredentialAdmit =
        notification.route === IPEX_ADMIT_NOTIFICATION_ROUTE;
    if (!isCredentialGrant && !isCredentialAdmit) {
        return notification;
    }

    if (notification.anchorSaid === null) {
        return {
            ...notification,
            status: 'error',
            message: 'Credential IPEX notification is missing its EXN SAID.',
        };
    }

    const anchorSaid = notification.anchorSaid;

    try {
        const exchange = yield* callPromise(() =>
            client.exchanges().get(anchorSaid)
        );
        if (isCredentialGrant) {
            const credentialGrant = credentialGrantFromExchange({
                notification,
                exchange,
                localAids,
                credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
                loadedAt,
            });
            if (
                credentialGrant.status === 'notForThisWallet' &&
                !notification.read
            ) {
                yield* callPromise(() =>
                    client.notifications().mark(notification.id)
                );
            }

            return {
                ...notification,
                read:
                    notification.read ||
                    credentialGrant.status === 'notForThisWallet',
                status:
                    credentialGrant.status === 'actionable'
                        ? 'unread'
                        : 'processed',
                message:
                    credentialGrant.status === 'actionable'
                        ? `Credential grant from ${credentialGrant.issuerAid}`
                        : credentialGrant.status === 'admitted'
                          ? 'Credential grant was already admitted.'
                          : 'Credential grant is not addressed to this wallet.',
                credentialGrant,
            };
        }

        const credentialAdmit = credentialAdmitFromExchange({
            notification,
            exchange,
            localAids,
            loadedAt,
        });
        return {
            ...notification,
            status:
                credentialAdmit.status === 'received' ? 'unread' : 'processed',
            message:
                credentialAdmit.status === 'received'
                    ? `Credential admit from ${credentialAdmit.holderAid}`
                    : 'Credential admit is not addressed to this wallet.',
            credentialAdmit,
        };
    } catch (error) {
        return {
            ...notification,
            status: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Unable to hydrate credential IPEX notification.',
        };
    }
}

export function* hydrateCredentialIpexNotifications({
    client,
    notifications,
    localAids,
    loadedAt,
}: {
    client: SignifyClient;
    notifications: NotificationRecord[];
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<NotificationRecord[]> {
    const hydrated: NotificationRecord[] = [];

    for (const notification of notifications) {
        hydrated.push(
            yield* hydrateCredentialIpexNotification({
                client,
                notification,
                localAids,
                loadedAt,
            })
        );
    }

    return hydrated;
}

