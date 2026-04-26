/**
 * Subject attributes for the demo SEDI Voter ID credential schema.
 */
export interface SediVoterCredentialAttributes {
    i: string;
    fullName: string;
    voterId: string;
    precinctId: string;
    county: string;
    jurisdiction: string;
    electionId: string;
    eligible: boolean;
    expires: string;
}

/** Form draft for issuing the SEDI Voter ID credential. */
export interface SediVoterIssueFormDraft {
    fullName: string;
    voterId: string;
    precinctId: string;
    county: string;
    jurisdiction: string;
    electionId: string;
    eligible: boolean;
    expires: string;
}

export type SediVoterIssueTextFieldKey = Exclude<
    keyof SediVoterIssueFormDraft,
    'eligible'
>;

/** Catalog key for the schema-specific SEDI Voter ID issue flow. */
export const SEDI_VOTER_ID_CREDENTIAL_TYPE_KEY = 'sediVoterId' as const;

/** Form/projector discriminator for SEDI Voter ID credential handling. */
export const SEDI_VOTER_ID_FORM_KIND = 'sediVoterId' as const;

/** Default issuer registry label used by the current SEDI issue flow. */
export const SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME = 'sedi-voter-registry';

/** Stable alias used when resolving the SEDI schema OOBI through KERIA. */
export const SEDI_VOTER_ID_SCHEMA_OOBI_ALIAS = 'sedi-voter-id-schema';
