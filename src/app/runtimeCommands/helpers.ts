import type { OperationRouteLink } from '../../state/operations.slice';
import type { RequestIdOptions, RuntimeCommandContext } from './types';

export const identifiersRoute: OperationRouteLink = {
    label: 'View identifiers',
    path: '/identifiers',
};

export const contactsRoute: OperationRouteLink = {
    label: 'View contacts',
    path: '/contacts',
};

export const credentialsRoute: OperationRouteLink = {
    label: 'View credentials',
    path: '/credentials',
};

export const multisigRoute: OperationRouteLink = {
    label: 'View multisig',
    path: '/multisig',
};

export const notificationsRoute: OperationRouteLink = {
    label: 'View notifications',
    path: '/notifications',
};

/**
 * Use caller-supplied request ids when routes need stable operation ids, and
 * fall back to the runtime id source for commands that pass ids into workflows.
 */
export const requestIdFrom = (
    context: RuntimeCommandContext,
    options: RequestIdOptions = {}
): string => options.requestId ?? context.createRequestId();
