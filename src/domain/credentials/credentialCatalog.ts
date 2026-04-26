import type {
    CredentialSummaryRecord,
    SchemaRecord,
    SchemaResolutionStatus,
} from './credentialTypes';
import {
    buildSediVoterIdCredentialType,
    type SediVoterIdSchemaConfig,
} from './sediVoterId';
import type {
    SEDI_VOTER_ID_CREDENTIAL_TYPE_KEY,
    SEDI_VOTER_ID_FORM_KIND,
} from './sediVoterId';

/**
 * Pure catalog model for credential types the app can issue.
 *
 * This module must not import app config or Redux state. It defines the
 * domain shape; `src/config/credentialCatalog.ts` decides which records exist.
 */

/** Credential forms the app knows how to map into Signify issue payloads. */
export type IssueableCredentialFormKind = typeof SEDI_VOTER_ID_FORM_KIND;

/** Curated credential types this app can issue. */
export type IssueableCredentialTypeKey =
    typeof SEDI_VOTER_ID_CREDENTIAL_TYPE_KEY;

/** Static catalog record for one app-supported credential type. */
export interface IssueableCredentialTypeRecord {
    key: IssueableCredentialTypeKey;
    label: string;
    description: string;
    schemaSaid: string;
    schemaOobiUrl: string;
    formKind: IssueableCredentialFormKind;
}

/** UI-facing catalog row joined with local schema and credential facts. */
export interface IssueableCredentialTypeView
    extends IssueableCredentialTypeRecord {
    schemaStatus: SchemaResolutionStatus;
    schemaTitle: string | null;
    schemaDescription: string | null;
    schemaVersion: string | null;
    issuedCount: number;
    lastIssuedAt: string | null;
}

/** Minimal schema config required to build pure issueable credential records. */
export interface IssueableCredentialSchemaConfig {
    schemas: {
        sediVoterId: SediVoterIdSchemaConfig;
    };
}

/**
 * Build configured credential catalog records without importing app config.
 */
export const buildIssueableCredentialTypes = (
    config: IssueableCredentialSchemaConfig
): IssueableCredentialTypeRecord[] => {
    const credentialTypes = [
        buildSediVoterIdCredentialType(config.schemas.sediVoterId),
    ];

    return credentialTypes.filter(
        (type): type is IssueableCredentialTypeRecord => type !== null
    );
};

const latestCredentialTimestamp = (
    credential: CredentialSummaryRecord
): string =>
    credential.issuedAt ??
    credential.grantedAt ??
    credential.admittedAt ??
    credential.updatedAt;

/**
 * Join configured credential types with loaded schema and issued-credential
 * facts for UI display. This keeps Redux selectors deriving catalog views
 * instead of storing denormalized catalog state.
 */
export const buildIssueableCredentialTypeViews = ({
    types,
    schemas,
    issuedCredentials,
}: {
    types: readonly IssueableCredentialTypeRecord[];
    schemas: readonly SchemaRecord[];
    issuedCredentials: readonly CredentialSummaryRecord[];
}): IssueableCredentialTypeView[] =>
    types.map((type) => {
        const schema =
            schemas.find((candidate) => candidate.said === type.schemaSaid) ??
            null;
        const matchingCredentials = issuedCredentials.filter(
            (credential) => credential.schemaSaid === type.schemaSaid
        );
        const lastIssuedAt =
            matchingCredentials
                .map(latestCredentialTimestamp)
                .sort((left, right) => right.localeCompare(left))[0] ?? null;

        return {
            ...type,
            schemaStatus: schema?.status ?? 'unknown',
            schemaTitle: schema?.title ?? null,
            schemaDescription: schema?.description ?? null,
            schemaVersion: schema?.version ?? null,
            issuedCount: matchingCredentials.length,
            lastIssuedAt,
        };
    });
