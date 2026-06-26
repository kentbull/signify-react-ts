import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { delegationAnchorFromEvent } from '../../domain/identifiers/delegationHelpers';
import { callPromise } from '../../effects/promise';
import type {
    DelegationRequestNotification,
    NotificationRecord,
} from '../../state/notifications.slice';
import type { JsonRecord, KeriaNoteAttrs } from './base';
import { isRecord, stringValue } from './base';

export const DELEGATION_REQUEST_NOTIFICATION_ROUTE = '/delegate/request';

const embeddedDelegationEvent = (
    value: JsonRecord
): JsonRecord | null => {
    for (const key of ['ked', 'event', 'evt', 'icp', 'dip', 'rot', 'drt']) {
        const candidate = value[key];
        if (isRecord(candidate)) {
            return candidate;
        }
    }

    const embedded = value.e;
    if (isRecord(embedded)) {
        for (const key of [
            'ked',
            'event',
            'evt',
            'icp',
            'dip',
            'rot',
            'drt',
        ]) {
            const candidate = embedded[key];
            if (isRecord(candidate)) {
                return candidate;
            }
        }
    }

    return null;
};

const delegationRequestFromPayload = ({
    notification,
    payload,
    sourceAid,
    loadedAt,
}: {
    notification: NotificationRecord;
    payload: KeriaNoteAttrs;
    sourceAid: string | null;
    loadedAt: string;
}): DelegationRequestNotification => {
    const event = embeddedDelegationEvent(payload) ?? payload;
    const anchor = delegationAnchorFromEvent(event);
    const delegatorAid =
        stringValue(payload.delpre) ??
        stringValue(payload.delegatorAid) ??
        stringValue(event.di);
    const createdAt =
        stringValue(payload.dt) ??
        notification.dt ??
        notification.updatedAt ??
        loadedAt;

    if (delegatorAid === null) {
        throw new Error('Delegation request is missing the delegator AID.');
    }

    return {
        notificationId: notification.id,
        delegatorAid,
        delegateAid: anchor.i,
        delegateEventSaid: anchor.d,
        sequence: anchor.s,
        anchor,
        sourceAid,
        createdAt,
        status: 'actionable',
    };
};

function* hydrateDelegationRequestNotification({
    client,
    notification,
    noteAttrsById,
    localAids,
    loadedAt,
}: {
    client: SignifyClient;
    notification: NotificationRecord;
    noteAttrsById: ReadonlyMap<string, KeriaNoteAttrs>;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<NotificationRecord> {
    if (notification.route !== DELEGATION_REQUEST_NOTIFICATION_ROUTE) {
        return notification;
    }

    try {
        const rawAttrs = noteAttrsById.get(notification.id);
        const attrs = rawAttrs ?? {};
        const request = delegationRequestFromPayload({
            notification,
            payload: attrs,
            sourceAid: stringValue(attrs.src) ?? stringValue(attrs.i),
            loadedAt,
        });

        if (localAids.size > 0 && !localAids.has(request.delegatorAid)) {
            if (!notification.read) {
                yield* callPromise(() =>
                    client.notifications().mark(notification.id)
                );
            }

            return {
                ...notification,
                read: true,
                status: 'processed',
                message:
                    'Delegation request is not addressed to a local delegator AID.',
                delegationRequest: {
                    ...request,
                    status: 'notForThisWallet',
                },
            };
        }

        return {
            ...notification,
            status: notification.read ? 'processed' : 'unread',
            message:
                notification.message ??
                `Delegation request for ${request.delegatorAid}`,
            delegationRequest: {
                ...request,
                status: notification.read ? 'approved' : 'actionable',
            },
        };
    } catch (error) {
        return {
            ...notification,
            status: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Unable to hydrate delegation request notification.',
            delegationRequest: null,
        };
    }
}

export function* hydrateDelegationRequestNotifications({
    client,
    notifications,
    noteAttrsById,
    localAids,
    loadedAt,
}: {
    client: SignifyClient;
    notifications: NotificationRecord[];
    noteAttrsById: ReadonlyMap<string, KeriaNoteAttrs>;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<NotificationRecord[]> {
    const hydrated: NotificationRecord[] = [];

    for (const notification of notifications) {
        hydrated.push(
            yield* hydrateDelegationRequestNotification({
                client,
                notification,
                noteAttrsById,
                localAids,
                loadedAt,
            })
        );
    }

    return hydrated;
}
