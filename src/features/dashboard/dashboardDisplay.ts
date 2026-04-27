import { formatTimestamp } from '../../app/timeFormat';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../../config/credentialCatalog';
import type {
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';

/**
 * Convert nullable dashboard timestamps into route display text.
 */
export const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

/**
 * Normalize optional dashboard text fields without leaking empty strings into views.
 */
export const displayText = (value: string | null | undefined): string =>
    value === undefined || value === null || value.trim().length === 0
        ? 'Not available'
        : value;

const schemaTypeLabel = (schemaSaid: string | null | undefined): string => {
    if (schemaSaid === undefined || schemaSaid === null) {
        return 'Unknown schema';
    }

    return (
        ISSUEABLE_CREDENTIAL_TYPES.find(
            (type) => type.schemaSaid === schemaSaid
        )?.label ?? 'Credential schema'
    );
};

/**
 * Prefer the resolved schema title, then the catalog label, then a generic fallback.
 */
export const schemaTitle = (schema: SchemaRecord): string =>
    schema.title ?? schemaTypeLabel(schema.said);

/**
 * Resolve a credential's schema SAID into the dashboard type label.
 */
export const credentialTypeLabel = (
    credential: CredentialSummaryRecord
): string => schemaTypeLabel(credential.schemaSaid);

/**
 * Collapse credential persistence facts into the ledger status shown in dashboard lists.
 */
export const credentialLedgerStatus = (
    credential: CredentialSummaryRecord
): {
    label: string;
    tone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
} => {
    if (credential.error !== null || credential.status === 'error') {
        return { label: 'error', tone: 'error' };
    }

    if (credential.revokedAt !== null || credential.status === 'revoked') {
        return { label: 'revoked', tone: 'warning' };
    }

    return { label: 'issued', tone: 'success' };
};

/**
 * Display the registry key/name for credentials without requiring every record to be hydrated.
 */
export const registryDisplay = (
    credential: CredentialSummaryRecord,
    registriesById: ReadonlyMap<string, RegistryRecord>
): string => {
    if (credential.registryId === null) {
        return 'Not available';
    }

    const registry = registriesById.get(credential.registryId);
    if (registry === undefined) {
        return credential.registryId;
    }

    return registry.regk || registry.registryName || registry.id;
};
