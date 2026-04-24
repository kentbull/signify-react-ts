import type {
    DashboardLoaderData,
    ContactsLoaderData,
    NotificationsLoaderData,
    IdentifiersLoaderData,
    MultisigLoaderData,
    ClientLoaderData,
    CredentialsLoaderData,
    RouteDataRuntime,
} from './routeData.types';
import { toRouteError } from './routeData.shared';

/**
 * Loader for `/dashboard`.
 */
export const loadDashboard = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<DashboardLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        await runtime.listIdentifiers({ signal: request?.signal });
        await Promise.all([
            runtime.syncSessionInventory({ signal: request?.signal }),
            runtime.syncKnownCredentialSchemas({ signal: request?.signal }),
            runtime.syncCredentialRegistries({ signal: request?.signal }),
            runtime.syncCredentialInventory({ signal: request?.signal }),
        ]);
        await runtime.syncCredentialIpexActivity({ signal: request?.signal });
        return { status: 'ready' };
    } catch (error) {
        return {
            status: 'error',
            message: `Unable to refresh dashboard inventory: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/contacts`.
 */
export const loadContacts = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<ContactsLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        await Promise.all([
            runtime.listIdentifiers({ signal: request?.signal }),
            runtime.syncSessionInventory({ signal: request?.signal }),
        ]);
        return { status: 'ready' };
    } catch (error) {
        return {
            status: 'error',
            message: `Unable to refresh contact inventory: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/notifications`.
 */
export const loadNotifications = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<NotificationsLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        const [identifiers] = await Promise.all([
            runtime.listIdentifiers({ signal: request?.signal }),
            runtime.syncSessionInventory({ signal: request?.signal }),
        ]);
        return { status: 'ready', identifiers };
    } catch (error) {
        return {
            status: 'error',
            identifiers: [],
            message: `Unable to refresh notifications: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/identifiers`.
 *
 * A disconnected route returns blocked data so direct navigation renders the
 * connection-required state. Identifier list failures are recoverable and
 * returned as typed loader data because the user may still be connected and
 * able to retry after fixing KERIA CORS or network setup.
 */
export const loadIdentifiers = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<IdentifiersLoaderData> => {
    const client = runtime.getClient();
    if (client === null) {
        return { status: 'blocked' };
    }

    try {
        return {
            status: 'ready',
            identifiers: await runtime.listIdentifiers({
                signal: request?.signal,
            }),
        };
    } catch (error) {
        const normalized = toRouteError(error);
        return {
            status: 'error',
            identifiers: [],
            message: `Unable to load identifiers: ${normalized.message}. Connect can succeed even when the browser blocks signed KERIA resource requests; check that ${client.url ?? 'KERIA'} is reachable from this page and allows the Signify signed-request headers.`,
        };
    }
};

/**
 * Loader for `/multisig`.
 */
export const loadMultisig = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<MultisigLoaderData> => {
    const client = runtime.getClient();
    if (client === null) {
        return { status: 'blocked' };
    }

    try {
        const [identifiers] = await Promise.all([
            runtime.listIdentifiers({ signal: request?.signal }),
            runtime.syncSessionInventory({ signal: request?.signal }),
        ]);
        const groupDetails = await Promise.all(
            identifiers
                .filter((identifier) => 'group' in identifier)
                .map((identifier) =>
                    runtime.getMultisigGroupDetails(identifier, {
                        signal: request?.signal,
                    })
                )
        );
        return { status: 'ready', identifiers, groupDetails };
    } catch (error) {
        return {
            status: 'error',
            identifiers: [],
            groupDetails: [],
            message: `Unable to load multisig inventory: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/client`.
 *
 * This refreshes the Signify state snapshot through the shared runtime so the
 * client summary route shows current controller/agent data after route
 * navigation and post-action revalidation.
 */
export const loadClient = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<ClientLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    const summary =
        (await runtime.refreshState({ signal: request?.signal })) ??
        runtime.getState();
    return summary === null
        ? { status: 'blocked' }
        : { status: 'ready', summary };
};

/**
 * Loader for `/credentials`.
 *
 * The route is a connected placeholder today; keeping the loader explicit sets
 * the gating contract for future issuer/holder/verifier credential children.
 */
export const loadCredentials = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<CredentialsLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        await runtime.listIdentifiers({ signal: request?.signal });
        await Promise.all([
            runtime.syncSessionInventory({ signal: request?.signal }),
            runtime.syncKnownCredentialSchemas({ signal: request?.signal }),
            runtime.syncCredentialRegistries({ signal: request?.signal }),
            runtime.syncCredentialInventory({ signal: request?.signal }),
        ]);
        await runtime.syncCredentialIpexActivity({ signal: request?.signal });
        return { status: 'ready' };
    } catch (error) {
        return {
            status: 'error',
            message: `Unable to refresh credential inventory: ${toRouteError(error).message}`,
        };
    }
};
