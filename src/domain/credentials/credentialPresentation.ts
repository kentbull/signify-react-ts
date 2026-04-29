import type { CredentialSummaryRecord } from './credentialTypes';

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
