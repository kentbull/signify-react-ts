import type { ContactRecord } from '../../state/contacts.slice';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type {
    CredentialIpexActivityRecord,
    CredentialGrantNotification,
    CredentialSummaryRecord,
    RegistryRecord,
} from '../../domain/credentials/credentialTypes';

/**
 * Dashboard sub-route modes derived from the current location.
 */
export type DashboardMode =
    | 'overview'
    | 'schemas'
    | 'issuedCredentials'
    | 'heldCredentials'
    | 'credentialDetail';

/**
 * AID-to-label lookup shared by dashboard credential detail components.
 */
export type AidAliases = ReadonlyMap<string, string>;

/**
 * Normalized grant/admit activity row for one credential detail view.
 */
export interface CredentialActivityEntry {
    id: string;
    kind: 'grant' | 'admit';
    direction: 'sent' | 'received' | 'unknown';
    title: string;
    timestamp: string | null;
    said: string;
    primaryAid: string | null;
    secondaryAid: string | null;
}

/**
 * Determine which dashboard presentation component should render for a route path.
 */
export const dashboardModeForPath = (pathname: string): DashboardMode => {
    if (pathname === '/dashboard/schemas') {
        return 'schemas';
    }

    if (pathname === '/dashboard/credentials/issued') {
        return 'issuedCredentials';
    }

    if (pathname === '/dashboard/credentials/held') {
        return 'heldCredentials';
    }

    if (pathname.startsWith('/dashboard/credentials/')) {
        return 'credentialDetail';
    }

    return 'overview';
};

/**
 * Build the stable dashboard credential detail route.
 */
export const credentialDetailPath = (said: string): string =>
    `/dashboard/credentials/${encodeURIComponent(said)}`;

/**
 * Merge exchange activity and grant notification facts for one credential timeline.
 */
export const buildCredentialActivity = ({
    credential,
    grantNotifications,
    exchangeActivities,
}: {
    credential: CredentialSummaryRecord;
    grantNotifications: readonly CredentialGrantNotification[];
    exchangeActivities: readonly CredentialIpexActivityRecord[];
}): CredentialActivityEntry[] => {
    const entries: CredentialActivityEntry[] = [];

    for (const activity of exchangeActivities) {
        const directionLabel =
            activity.direction === 'sent'
                ? 'Sent'
                : activity.direction === 'received'
                  ? 'Received'
                  : 'Observed';
        const kindLabel = activity.kind === 'grant' ? 'Grant' : 'Admit';
        entries.push({
            id: `exchange:${activity.exchangeSaid}`,
            kind: activity.kind,
            direction: activity.direction,
            title: `${directionLabel} ${kindLabel}`,
            timestamp: activity.createdAt,
            said: activity.exchangeSaid,
            primaryAid: activity.senderAid,
            secondaryAid: activity.recipientAid,
        });
    }

    const matchingGrantNotifications = grantNotifications.filter(
        (grant) =>
            grant.credentialSaid === credential.said &&
            !entries.some((entry) => entry.said === grant.grantSaid)
    );

    if (matchingGrantNotifications.length > 0) {
        for (const grant of matchingGrantNotifications) {
            entries.push({
                id: `received-grant:${grant.grantSaid}`,
                kind: 'grant',
                direction: 'received',
                title: 'Received Grant',
                timestamp: grant.createdAt,
                said: grant.grantSaid,
                primaryAid: grant.issuerAid,
                secondaryAid: grant.holderAid,
            });
        }
    } else if (
        credential.direction === 'held' &&
        credential.grantSaid !== null &&
        !entries.some((entry) => entry.said === credential.grantSaid)
    ) {
        entries.push({
            id: `received-grant:${credential.grantSaid}`,
            kind: 'grant',
            direction: 'received',
            title: 'Received Grant',
            timestamp: credential.grantedAt ?? credential.admittedAt,
            said: credential.grantSaid,
            primaryAid: credential.issuerAid,
            secondaryAid: credential.holderAid,
        });
    }

    if (
        credential.direction === 'held' &&
        credential.admitSaid !== null &&
        !entries.some((entry) => entry.said === credential.admitSaid)
    ) {
        entries.push({
            id: `sent-admit:${credential.admitSaid}`,
            kind: 'admit',
            direction: 'sent',
            title: 'Sent Admit',
            timestamp: credential.admittedAt,
            said: credential.admitSaid,
            primaryAid: credential.holderAid,
            secondaryAid: credential.issuerAid,
        });
    }

    if (
        credential.direction === 'issued' &&
        credential.grantSaid !== null &&
        !entries.some((entry) => entry.said === credential.grantSaid)
    ) {
        entries.push({
            id: `sent-grant:${credential.grantSaid}`,
            kind: 'grant',
            direction: 'sent',
            title: 'Sent Grant',
            timestamp: credential.grantedAt,
            said: credential.grantSaid,
            primaryAid: credential.issuerAid,
            secondaryAid: credential.holderAid,
        });
    }

    return entries.sort((left, right) => {
        if (left.timestamp === null && right.timestamp === null) {
            return left.title.localeCompare(right.title);
        }

        if (left.timestamp === null) {
            return 1;
        }

        if (right.timestamp === null) {
            return -1;
        }

        return left.timestamp.localeCompare(right.timestamp);
    });
};

/**
 * Index registries by local id and registry key for dashboard credential lookup.
 */
export const buildDashboardRegistryMap = (
    registries: readonly RegistryRecord[]
): ReadonlyMap<string, RegistryRecord> => {
    const byId = new Map<string, RegistryRecord>();
    for (const registry of registries) {
        byId.set(registry.id, registry);
        if (registry.regk.length > 0) {
            byId.set(registry.regk, registry);
        }
    }
    return byId;
};

/**
 * Build the dashboard AID alias map from contacts and local identifiers.
 */
export const buildDashboardAidAliases = ({
    contacts,
    identifiers,
}: {
    contacts: readonly ContactRecord[];
    identifiers: readonly IdentifierSummary[];
}): AidAliases => {
    const aliases = new Map<string, string>();
    for (const contact of contacts) {
        if (contact.aid !== null) {
            aliases.set(contact.aid, contact.alias);
        }
    }
    for (const identifier of identifiers) {
        aliases.set(identifier.prefix, identifier.name);
    }
    return aliases;
};
