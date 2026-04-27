import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { callPromise } from '../../effects/promise';
import type { MultisigThresholdSith } from '../../domain/multisig/multisigThresholds';
import type {
    MultisigExchangeProgress,
    MultisigRequestNotification,
    MultisigRequestRoute,
    NotificationRecord,
} from '../../state/notifications.slice';
import {
    MULTISIG_ICP_ROUTE,
    MULTISIG_IXN_ROUTE,
    MULTISIG_ROT_ROUTE,
    MULTISIG_RPY_ROUTE,
} from '../multisig.service';
import {
    exchangeGroupAid,
    exchangeRoute,
    exchangeSenderAid,
    isRecord,
    requireRecord,
    stringArray,
    stringValue,
} from './base';
import { isSyntheticExchangeNotificationId } from './syntheticIds';

const MULTISIG_NOTIFICATION_ROUTES = new Set<string>([
    MULTISIG_ICP_ROUTE,
    MULTISIG_RPY_ROUTE,
    MULTISIG_IXN_ROUTE,
    MULTISIG_ROT_ROUTE,
]);

export const MULTISIG_NOTIFICATION_ROUTE_LIST = [
    MULTISIG_ICP_ROUTE,
    MULTISIG_RPY_ROUTE,
    MULTISIG_IXN_ROUTE,
    MULTISIG_ROT_ROUTE,
] as const satisfies readonly MultisigRequestRoute[];

export const isMultisigRequestRoute = (
    route: string | null
): route is MultisigRequestRoute =>
    route === MULTISIG_ICP_ROUTE ||
    route === MULTISIG_RPY_ROUTE ||
    route === MULTISIG_IXN_ROUTE ||
    route === MULTISIG_ROT_ROUTE;

export const multisigRequestLabel = (route: MultisigRequestRoute): string => {
    switch (route) {
        case MULTISIG_ICP_ROUTE:
            return 'Group invitation';
        case MULTISIG_RPY_ROUTE:
            return 'Agent authorization';
        case MULTISIG_IXN_ROUTE:
            return 'Interaction approval';
        case MULTISIG_ROT_ROUTE:
            return 'Rotation approval';
    }
};

export const multisigProgressKey = (
    route: MultisigRequestRoute,
    groupAid: string | null
): string => `${route}:${groupAid ?? 'unknown'}`;

const multisigEmbeddedEvent = (
    exn: Record<string, unknown>
): { type: string | null; said: string | null } => {
    const embeds = isRecord(exn.e) ? exn.e : {};
    for (const key of ['icp', 'rot', 'ixn', 'rpy']) {
        const event = embeds[key];
        if (isRecord(event)) {
            return {
                type: key,
                said: stringValue(event.d),
            };
        }
    }

    return { type: null, said: null };
};

const isSithValue = (value: unknown): value is MultisigThresholdSith =>
    typeof value === 'string' ||
    typeof value === 'number' ||
    (Array.isArray(value) &&
        value.every(
            (item) =>
                typeof item === 'string' ||
                (Array.isArray(item) &&
                    item.every((nested) => typeof nested === 'string'))
        ));

const compactPayloadSummary = (value: unknown): string | null => {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    try {
        const serialized = JSON.stringify(value);
        return serialized.length > 240
            ? `${serialized.slice(0, 237)}...`
            : serialized;
    } catch {
        return String(value);
    }
};

const multisigEmbeddedDetails = (
    exn: Record<string, unknown>
): {
    signingThreshold: MultisigThresholdSith | null;
    rotationThreshold: MultisigThresholdSith | null;
    embeddedPayloadSummary: string | null;
} => {
    const embeds = isRecord(exn.e) ? exn.e : {};
    const icp = isRecord(embeds.icp) ? embeds.icp : null;
    if (icp !== null) {
        return {
            signingThreshold: isSithValue(icp.kt) ? icp.kt : null,
            rotationThreshold: isSithValue(icp.nt) ? icp.nt : null,
            embeddedPayloadSummary: null,
        };
    }

    const rot = isRecord(embeds.rot) ? embeds.rot : null;
    if (rot !== null) {
        return {
            signingThreshold: isSithValue(rot.kt) ? rot.kt : null,
            rotationThreshold: isSithValue(rot.nt) ? rot.nt : null,
            embeddedPayloadSummary: null,
        };
    }

    const ixn = isRecord(embeds.ixn) ? embeds.ixn : null;
    if (ixn !== null) {
        return {
            signingThreshold: null,
            rotationThreshold: null,
            embeddedPayloadSummary: compactPayloadSummary(ixn.a),
        };
    }

    const rpy = isRecord(embeds.rpy) ? embeds.rpy : null;
    return {
        signingThreshold: null,
        rotationThreshold: null,
        embeddedPayloadSummary:
            rpy === null
                ? null
                : compactPayloadSummary({
                      route: rpy.r,
                      attributes: rpy.a,
                  }),
    };
};

const expectedMultisigMembers = ({
    route,
    signingMemberAids,
    rotationMemberAids,
}: {
    route: MultisigRequestRoute;
    signingMemberAids: readonly string[];
    rotationMemberAids: readonly string[];
}): string[] =>
    route === MULTISIG_RPY_ROUTE || route === MULTISIG_ROT_ROUTE
        ? [...new Set([...signingMemberAids, ...rotationMemberAids])]
        : [...new Set(signingMemberAids)];

const multisigProgressFromResponses = ({
    groupAid,
    route,
    expectedMemberAids,
    senderAid,
    responses,
}: {
    groupAid: string | null;
    route: MultisigRequestRoute;
    expectedMemberAids: readonly string[];
    senderAid: string | null;
    responses: ReadonlyMap<string, ReadonlySet<string>>;
}): MultisigExchangeProgress => {
    const expected = [...new Set(expectedMemberAids)];
    const responseKey = multisigProgressKey(route, groupAid);
    const responded = new Set(responses.get(responseKey) ?? []);
    if (senderAid !== null) {
        responded.add(senderAid);
    }
    const respondedMemberAids = expected.filter((aid) => responded.has(aid));
    const waitingMemberAids = expected.filter((aid) => !responded.has(aid));

    return {
        groupAid,
        route,
        expectedMemberAids: expected,
        respondedMemberAids,
        waitingMemberAids,
        completed: respondedMemberAids.length,
        total: expected.length,
    };
};

export const multisigResponseProgressMap = (
    exchanges: readonly unknown[]
): ReadonlyMap<string, ReadonlySet<string>> => {
    const progress = new Map<string, Set<string>>();

    for (const exchange of exchanges) {
        let route: string | null;
        let groupAid: string | null;
        let senderAid: string | null;
        try {
            route = exchangeRoute(exchange);
            groupAid = exchangeGroupAid(exchange);
            senderAid = exchangeSenderAid(exchange);
        } catch {
            continue;
        }
        if (!isMultisigRequestRoute(route) || senderAid === null) {
            continue;
        }

        const key = multisigProgressKey(route, groupAid);
        const responders = progress.get(key) ?? new Set<string>();
        responders.add(senderAid);
        progress.set(key, responders);
    }

    return progress;
};

const requestStatus = ({
    localAids,
    notification,
    route,
    senderAid,
    groupAid,
    signingMemberAids,
    rotationMemberAids,
    respondedMemberAids,
}: {
    localAids: ReadonlySet<string>;
    notification: NotificationRecord;
    route: MultisigRequestRoute;
    senderAid: string | null;
    groupAid: string | null;
    signingMemberAids: readonly string[];
    rotationMemberAids: readonly string[];
    respondedMemberAids: readonly string[];
}): MultisigRequestNotification['status'] => {
    if (
        localAids.size > 0 &&
        respondedMemberAids.some((aid) => localAids.has(aid))
    ) {
        return 'approved';
    }

    if (senderAid !== null && localAids.has(senderAid)) {
        return 'approved';
    }

    if (notification.read) {
        return 'approved';
    }

    if (localAids.size === 0) {
        return 'actionable';
    }

    if (route === MULTISIG_RPY_ROUTE) {
        return groupAid !== null && localAids.has(groupAid)
            ? 'actionable'
            : 'notForThisWallet';
    }

    const participants = new Set([...signingMemberAids, ...rotationMemberAids]);
    return [...localAids].some((aid) => participants.has(aid))
        ? 'actionable'
        : 'notForThisWallet';
};

const multisigRequestFromGroup = ({
    notification,
    group,
    localAids,
    loadedAt,
    responseProgress,
}: {
    notification: NotificationRecord;
    group: unknown;
    localAids: ReadonlySet<string>;
    loadedAt: string;
    responseProgress: ReadonlyMap<string, ReadonlySet<string>>;
}): MultisigRequestNotification => {
    const groupRecord = requireRecord(group, 'Multisig request');
    const exn = requireRecord(groupRecord.exn, 'Multisig request EXN');
    const route = stringValue(exn.r);
    if (!isMultisigRequestRoute(route)) {
        throw new Error('Notification is not a supported multisig request.');
    }

    const attrs = isRecord(exn.a) ? exn.a : {};
    const exnSaid = stringValue(exn.d) ?? notification.anchorSaid;
    const groupAid = stringValue(attrs.gid);
    const signingMemberAids = stringArray(attrs.smids);
    const rotationMemberAids = stringArray(attrs.rmids);
    const embedded = multisigEmbeddedEvent(exn);
    const details = multisigEmbeddedDetails(exn);

    if (exnSaid === null) {
        throw new Error('Multisig request is missing its EXN SAID.');
    }

    const senderAid =
        stringValue(exn.i) ??
        stringValue(groupRecord.sender) ??
        stringValue(attrs.sender);
    const effectiveRotationMemberAids =
        rotationMemberAids.length > 0 ? rotationMemberAids : signingMemberAids;
    const expectedMemberAids = expectedMultisigMembers({
        route,
        signingMemberAids,
        rotationMemberAids: effectiveRotationMemberAids,
    });
    const progress = multisigProgressFromResponses({
        groupAid,
        route,
        expectedMemberAids,
        senderAid,
        responses: responseProgress,
    });
    const status = requestStatus({
        localAids,
        notification,
        route,
        senderAid,
        groupAid,
        signingMemberAids,
        rotationMemberAids: effectiveRotationMemberAids,
        respondedMemberAids: progress.respondedMemberAids,
    });

    return {
        notificationId: notification.id,
        exnSaid,
        route,
        senderAid,
        groupAid,
        groupAlias:
            route === '/multisig/icp'
                ? null
                : (stringValue(groupRecord.groupName) ??
                  stringValue(attrs.name) ??
                  stringValue(attrs.alias)),
        signingMemberAids,
        rotationMemberAids: effectiveRotationMemberAids,
        signingThreshold: details.signingThreshold,
        rotationThreshold: details.rotationThreshold,
        embeddedPayloadSummary: details.embeddedPayloadSummary,
        embeddedEventType: embedded.type,
        embeddedEventSaid: embedded.said,
        progress,
        createdAt:
            stringValue(exn.dt) ??
            notification.dt ??
            notification.updatedAt ??
            loadedAt,
        status,
    };
};

export function* hydrateMultisigRequestNotification({
    client,
    notification,
    localAids,
    loadedAt,
    responseProgress,
}: {
    client: SignifyClient;
    notification: NotificationRecord;
    localAids: ReadonlySet<string>;
    loadedAt: string;
    responseProgress: ReadonlyMap<string, ReadonlySet<string>>;
}): EffectionOperation<NotificationRecord> {
    const canHydrate =
        MULTISIG_NOTIFICATION_ROUTES.has(notification.route) ||
        (notification.anchorSaid !== null && notification.route === '/exn');
    if (!canHydrate) {
        return notification;
    }

    if (notification.anchorSaid === null) {
        return MULTISIG_NOTIFICATION_ROUTES.has(notification.route)
            ? {
                  ...notification,
                  status: 'error',
                  message: 'Multisig notification is missing its request SAID.',
              }
            : notification;
    }

    const requestSaid = notification.anchorSaid;

    try {
        let requestSource: unknown;
        try {
            const response = yield* callPromise(() =>
                client.groups().getRequest(requestSaid)
            );
            requestSource = response[0];
        } catch {
            requestSource = undefined;
        }
        if (requestSource === undefined) {
            requestSource = yield* callPromise(() =>
                client.exchanges().get(requestSaid)
            );
        }

        const request = multisigRequestFromGroup({
            notification,
            group: requestSource,
            localAids,
            loadedAt,
            responseProgress,
        });

        if (
            request.status === 'notForThisWallet' &&
            !notification.read &&
            !isSyntheticExchangeNotificationId(notification.id)
        ) {
            yield* callPromise(() =>
                client.notifications().mark(notification.id)
            );
        }

        return {
            ...notification,
            read: notification.read || request.status === 'notForThisWallet',
            status: request.status === 'actionable' ? 'unread' : 'processed',
            message:
                request.status === 'actionable'
                    ? multisigRequestLabel(request.route)
                    : request.status === 'notForThisWallet'
                      ? 'Multisig request is not addressed to this wallet.'
                      : `${multisigRequestLabel(request.route)} handled.`,
            multisigRequest: request,
        };
    } catch (error) {
        if (!MULTISIG_NOTIFICATION_ROUTES.has(notification.route)) {
            return notification;
        }

        return {
            ...notification,
            status: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Unable to hydrate multisig request notification.',
            multisigRequest: null,
        };
    }
}

export function* hydrateMultisigRequestNotifications({
    client,
    notifications,
    localAids,
    loadedAt,
    responseProgress,
}: {
    client: SignifyClient;
    notifications: NotificationRecord[];
    localAids: ReadonlySet<string>;
    loadedAt: string;
    responseProgress: ReadonlyMap<string, ReadonlySet<string>>;
}): EffectionOperation<NotificationRecord[]> {
    const hydrated: NotificationRecord[] = [];

    for (const notification of notifications) {
        hydrated.push(
            yield* hydrateMultisigRequestNotification({
                client,
                notification,
                localAids,
                loadedAt,
                responseProgress,
            })
        );
    }

    return hydrated;
}

