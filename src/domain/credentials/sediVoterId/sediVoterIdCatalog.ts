import type { IssueableCredentialTypeRecord } from '../credentialCatalog';
import {
    SEDI_VOTER_ID_CREDENTIAL_TYPE_KEY,
    SEDI_VOTER_ID_FORM_KIND,
} from './sediVoterIdTypes';

/**
 * App config subset required to enable the SEDI Voter ID credential type.
 */
export interface SediVoterIdSchemaConfig {
    said: string | null;
    oobiUrl: string | null;
}

/**
 * Build the catalog record for the SEDI Voter ID schema when configured.
 *
 * Returning null keeps incomplete schema config out of the issueable catalog
 * without forcing the pure domain layer to know where config came from.
 */
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
