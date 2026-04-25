import type { IssueableCredentialTypeRecord } from '../credentialCatalog';
import {
    SEDI_VOTER_ID_CREDENTIAL_TYPE_KEY,
    SEDI_VOTER_ID_FORM_KIND,
} from './sediVoterIdTypes';

export interface SediVoterIdSchemaConfig {
    said: string | null;
    oobiUrl: string | null;
}

export const buildSediVoterIdCredentialType = (
    schema: SediVoterIdSchemaConfig
): IssueableCredentialTypeRecord | null => {
    if (schema.said === null || schema.oobiUrl === null) {
        return null;
    }

    return {
        key: SEDI_VOTER_ID_CREDENTIAL_TYPE_KEY,
        label: 'SEDI Voter ID',
        description: 'Voter eligibility credential for the SEDI demo.',
        schemaSaid: schema.said,
        schemaOobiUrl: schema.oobiUrl,
        formKind: SEDI_VOTER_ID_FORM_KIND,
    };
};

