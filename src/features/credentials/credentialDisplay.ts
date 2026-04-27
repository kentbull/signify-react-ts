import { formatTimestamp } from '../../app/timeFormat';
import { abbreviateMiddle } from '../../domain/contacts/contactHelpers';
import type {
    CredentialSummaryRecord,
    RegistryRecord,
} from '../../domain/credentials/credentialTypes';
import type { IssueableCredentialTypeView } from '../../domain/credentials/credentialCatalog';

/**
 * Convert nullable credential timestamps into route display text.
 */
export const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

/**
 * Normalize nullable AID-like values for credential telemetry rows.
 */
export const aidLabel = (value: string | null | undefined): string =>
    value === null || value === undefined ? 'Not available' : value;

/**
 * Map persisted credential status to console pill tone.
 */
export const statusTone = (
    status: CredentialSummaryRecord['status']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' =>
    status === 'error'
        ? 'error'
        : status === 'revoked'
          ? 'warning'
          : status === 'admitted'
            ? 'success'
            : status === 'grantSent' || status === 'pendingAdmit'
              ? 'info'
              : 'neutral';

/**
 * Map credential schema readiness to console pill tone.
 */
export const schemaStatusTone = (
    status: IssueableCredentialTypeView['schemaStatus']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' =>
    status === 'resolved'
        ? 'success'
        : status === 'resolving'
          ? 'info'
          : status === 'error'
            ? 'error'
            : 'warning';

/**
 * Build the stable credentials route path for an optional selected AID.
 */
export const credentialPath = (aid?: string): string =>
    aid === undefined ? '/credentials' : `/credentials/${encodeURIComponent(aid)}`;

/**
 * Build the stable credential issuer route for a selected AID.
 */
export const issuerPath = (aid: string): string => `${credentialPath(aid)}/issuer`;

/**
 * Build the stable issuer credential-type route.
 */
export const issuerTypePath = (aid: string, typeKey: string): string =>
    `${issuerPath(aid)}/${encodeURIComponent(typeKey)}`;

/**
 * Build the stable credential wallet route for a selected AID.
 */
export const walletPath = (aid: string): string => `${credentialPath(aid)}/wallet`;

/**
 * Resolve a schema SAID to the known credential type label when possible.
 */
export const schemaLabel = (
    schemaSaid: string | null,
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>
): string => {
    if (schemaSaid === null) {
        return 'Not available';
    }

    return (
        credentialTypesBySchema.get(schemaSaid)?.label ??
        abbreviateMiddle(schemaSaid, 18)
    );
};

/**
 * Prefer human registry names while retaining the identifier needed for issuance.
 */
export const registryLabel = (
    registryId: string | null,
    registries: readonly RegistryRecord[]
): string => {
    if (registryId === null) {
        return 'Not available';
    }

    const registry =
        registries.find(
            (candidate) =>
                candidate.id === registryId || candidate.regk === registryId
        ) ?? null;
    return registry?.registryName ?? abbreviateMiddle(registryId, 18);
};
