import type { CredentialSummaryRecord } from './credentialTypes';
import type { IdentifierSummary } from '../identifiers/identifierTypes';

/**
 * KERIA's current W3C projection path supports the Isomer VRD credential only.
 *
 * Keep this explicit in the app so W3C Present does not look like a generic
 * replacement for IPEX Grant or a generic ACDC presentation mechanism.
 */
export const W3C_PRESENTABLE_VRD_SCHEMA_SAID =
    'EAyv2DLocYxJlPrWAfYBuHWDpjCStdQBzNLg0-3qQ-KP';

/** Return whether this credential can use the current W3C Present workflow. */
export const isW3CPresentableVrdCredential = (
    credential: CredentialSummaryRecord
): boolean => credential.schemaSaid === W3C_PRESENTABLE_VRD_SCHEMA_SAID;

/** Select the local AID that should run W3C Present for this credential. */
export const selectCredentialW3CPresenter = (
    credential: CredentialSummaryRecord,
    identifiers: readonly IdentifierSummary[]
): IdentifierSummary | null => {
    const localByAid = new Map(
        identifiers.map((identifier) => [identifier.prefix, identifier])
    );
    const issuer =
        credential.issuerAid === null
            ? null
            : (localByAid.get(credential.issuerAid) ?? null);
    const holder =
        credential.holderAid === null
            ? null
            : (localByAid.get(credential.holderAid) ?? null);

    return credential.direction === 'held'
        ? (holder ?? issuer)
        : (issuer ?? holder);
};
