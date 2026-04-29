import type { SediVoterCredentialAttributes } from './sediVoterId';

export type { SediVoterCredentialAttributes } from './sediVoterId';

/**
 * Serializable subject attributes projected from a known credential schema.
 *
 * Keep this union explicit. Adding a new credential type means adding that
 * schema's attribute type here and a projector in the schema-specific domain
 * directory, not widening the app to untyped credential payloads.
 */
export type CredentialSubjectAttributes = SediVoterCredentialAttributes;

/** Local side of a credential known to this connected wallet. */
export type CredentialDirection = 'issued' | 'held';

/** Local status of a credential as it moves through issuer/holder flows. */
export type CredentialStatus =
    | 'draft'
    | 'issued'
    | 'grantSent'
    | 'pendingAdmit'
    | 'admitted'
    | 'revoked'
    | 'error';

/**
 * Minimal credential projection stored for workflow/UI coordination.
 */
export interface CredentialSummaryRecord {
    said: string;
    schemaSaid: string | null;
    registryId: string | null;
    issuerAid: string | null;
    holderAid: string | null;
    direction: CredentialDirection;
    status: CredentialStatus;
    grantSaid: string | null;
    admitSaid: string | null;
    notificationId: string | null;
    issuedAt: string | null;
    grantedAt: string | null;
    admittedAt: string | null;
    revokedAt: string | null;
    error: string | null;
    attributes: CredentialSubjectAttributes | null;
    updatedAt: string;
}

/** IPEX exchange activity linked to one credential. */
export interface CredentialIpexActivityRecord {
    id: string;
    credentialSaid: string;
    exchangeSaid: string;
    route: string;
    kind: 'grant' | 'admit';
    direction: 'sent' | 'received' | 'unknown';
    senderAid: string | null;
    recipientAid: string | null;
    linkedGrantSaid: string | null;
    createdAt: string | null;
    updatedAt: string;
}

/** Resolution lifecycle for a credential schema OOBI. */
export type SchemaResolutionStatus =
    | 'unknown'
    | 'resolving'
    | 'resolved'
    | 'error';

/**
 * Local schema resolution record keyed by schema SAID.
 */
export interface SchemaRecord {
    said: string;
    oobi: string | null;
    status: SchemaResolutionStatus;
    title: string | null;
    description: string | null;
    credentialType: string | null;
    version: string | null;
    rules?: Record<string, unknown> | null;
    error: string | null;
    updatedAt: string | null;
}

/** Credential inventory plus embedded schemas observed while loading credentials. */
export interface CredentialInventorySnapshot {
    credentials: CredentialSummaryRecord[];
    schemas: SchemaRecord[];
}

/** Lifecycle of a credential registry known to the local issuer role. */
export type RegistryStatus = 'unknown' | 'creating' | 'ready' | 'error';

/**
 * Local registry projection keyed by registry id/key.
 */
export interface RegistryRecord {
    id: string;
    name: string;
    registryName: string;
    regk: string;
    issuerAlias: string;
    issuerAid: string;
    status: RegistryStatus;
    error: string | null;
    updatedAt: string | null;
}

/** Holder-facing state for inbound credential grant notifications. */
export type CredentialGrantNotificationStatus =
    | 'actionable'
    | 'notForThisWallet'
    | 'admitted'
    | 'error';

/** Issuer-facing state for inbound credential admit notifications. */
export type CredentialAdmitNotificationStatus =
    | 'received'
    | 'notForThisWallet'
    | 'error';

/**
 * Credential grant metadata hydrated from an IPEX grant EXN.
 */
export interface CredentialGrantNotification {
    notificationId: string;
    grantSaid: string;
    issuerAid: string;
    holderAid: string;
    credentialSaid: string;
    schemaSaid: string | null;
    attributes: Record<string, string | boolean>;
    createdAt: string;
    status: CredentialGrantNotificationStatus;
}

/**
 * Credential admit receipt metadata hydrated from an IPEX admit EXN.
 */
export interface CredentialAdmitNotification {
    notificationId: string;
    admitSaid: string;
    grantSaid: string | null;
    issuerAid: string | null;
    holderAid: string;
    createdAt: string;
    status: CredentialAdmitNotificationStatus;
}

/**
 * Minimal notification data required to project credential IPEX exchange
 * payloads without coupling domain helpers to the notification Redux slice.
 */
export interface CredentialExchangeNotificationReference {
    id: string;
    dt: string | null;
    read: boolean;
    anchorSaid: string | null;
}

/** Local identifier that may own credential registries. */
export interface CredentialRegistryOwner {
    issuerAlias: string;
    issuerAid: string;
}

/** Snapshot of registry inventory loaded for local issuer identifiers. */
export interface CredentialRegistryInventorySnapshot {
    registries: RegistryRecord[];
    loadedAt: string;
}
