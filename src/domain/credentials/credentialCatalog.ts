import type {
    CredentialSummaryRecord,
    SchemaRecord,
    SchemaResolutionStatus,
} from './credentialTypes';

/** Credential forms the app knows how to map into Signify issue payloads. */
export type IssueableCredentialFormKind = 'sediVoterId';

/** Curated credential types this app can issue. */
export type IssueableCredentialTypeKey = 'sediVoterId';

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

export interface IssueableCredentialSchemaConfig {
    schemas: {
        sediVoterId: {
            said: string | null;
            oobiUrl: string | null;
        };
    };
}

export const buildIssueableCredentialTypes = (
    config: IssueableCredentialSchemaConfig
): IssueableCredentialTypeRecord[] => {
    const schema = config.schemas.sediVoterId;
    if (schema.said === null || schema.oobiUrl === null) {
        return [];
    }

    return [
        {
            key: 'sediVoterId',
            label: 'SEDI Voter ID',
            description: 'Voter eligibility credential for the SEDI demo.',
            schemaSaid: schema.said,
            schemaOobiUrl: schema.oobiUrl,
            formKind: 'sediVoterId',
        },
    ];
};

const latestCredentialTimestamp = (
    credential: CredentialSummaryRecord
): string =>
    credential.issuedAt ??
    credential.grantedAt ??
    credential.admittedAt ??
    credential.updatedAt;

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
