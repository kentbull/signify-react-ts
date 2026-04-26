import type {
    SediVoterIssueFormDraft,
    SediVoterIssueTextFieldKey,
} from './sediVoterIdTypes';

/**
 * Text fields required by the SEDI Voter ID issuance form.
 *
 * Keeping this in the schema-specific domain package lets the UI render form
 * controls without owning credential-schema semantics.
 */
export const SEDI_VOTER_ISSUE_TEXT_FIELDS: readonly {
    key: SediVoterIssueTextFieldKey;
    label: string;
}[] = [
    { key: 'fullName', label: 'Full name' },
    { key: 'voterId', label: 'Voter id' },
    { key: 'precinctId', label: 'Precinct' },
    { key: 'county', label: 'County' },
    { key: 'jurisdiction', label: 'Jurisdiction' },
    { key: 'electionId', label: 'Election' },
    { key: 'expires', label: 'Expires' },
];

const requiredFieldLabels: Record<SediVoterIssueTextFieldKey, string> = {
    fullName: 'Full name',
    voterId: 'Voter id',
    precinctId: 'Precinct',
    county: 'County',
    jurisdiction: 'Jurisdiction',
    electionId: 'Election',
    expires: 'Expires',
};

/**
 * Field-level validation messages for a SEDI Voter ID issue draft.
 */
export type SediVoterIssueFormErrors = Partial<
    Record<SediVoterIssueTextFieldKey, string>
>;

/**
 * Validate user-entered SEDI Voter ID attributes before issuing an ACDC.
 */
export const validateSediVoterIssueDraft = (
    draft: SediVoterIssueFormDraft
): SediVoterIssueFormErrors => {
    const errors: SediVoterIssueFormErrors = {};

    for (const key of Object.keys(requiredFieldLabels) as SediVoterIssueTextFieldKey[]) {
        if (draft[key].trim().length === 0) {
            errors[key] = `${requiredFieldLabels[key]} is required.`;
        }
    }

    if (
        errors.expires === undefined &&
        !Number.isFinite(Date.parse(draft.expires.trim()))
    ) {
        errors.expires = 'Expires must be an ISO date time.';
    }

    return errors;
};

/**
 * Return whether a SEDI Voter ID issue draft has blocking validation errors.
 */
export const hasSediVoterIssueDraftErrors = (
    errors: SediVoterIssueFormErrors
): boolean => Object.keys(errors).length > 0;
