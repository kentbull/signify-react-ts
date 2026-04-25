import type { SediVoterCredentialAttributes } from './sediVoterIdTypes';

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

const booleanValue = (value: unknown): boolean | null =>
    typeof value === 'boolean' ? value : null;

const requireNonEmpty = (value: string, label: string): string => {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error(`${label} is required.`);
    }

    return normalized;
};

const recordString = (
    record: Record<string, unknown>,
    key: string
): string | null => stringValue(record[key]);

const normalizeDateTime = (value: string, label: string): string => {
    const normalized = requireNonEmpty(value, label);
    const parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${label} must be an ISO date time.`);
    }

    return normalized;
};

export const normalizeSediVoterAttributes = (
    input: SediVoterCredentialAttributes
): SediVoterCredentialAttributes => ({
    i: requireNonEmpty(input.i, 'Holder AID'),
    fullName: requireNonEmpty(input.fullName, 'Full name'),
    voterId: requireNonEmpty(input.voterId, 'Voter id'),
    precinctId: requireNonEmpty(input.precinctId, 'Precinct id'),
    county: requireNonEmpty(input.county, 'County'),
    jurisdiction: requireNonEmpty(input.jurisdiction, 'Jurisdiction'),
    electionId: requireNonEmpty(input.electionId, 'Election id'),
    eligible: input.eligible,
    expires: normalizeDateTime(input.expires, 'Expires'),
});

export const sediVoterAttributesFromSubject = (
    subject: Record<string, unknown> | null
): SediVoterCredentialAttributes | null => {
    if (subject === null) {
        return null;
    }

    const holderAid = recordString(subject, 'i');
    const fullName = recordString(subject, 'fullName');
    const voterId = recordString(subject, 'voterId');
    const precinctId = recordString(subject, 'precinctId');
    const county = recordString(subject, 'county');
    const jurisdiction = recordString(subject, 'jurisdiction');
    const electionId = recordString(subject, 'electionId');
    const eligible = booleanValue(subject.eligible);
    const expires = recordString(subject, 'expires');

    if (
        holderAid === null ||
        fullName === null ||
        voterId === null ||
        precinctId === null ||
        county === null ||
        jurisdiction === null ||
        electionId === null ||
        eligible === null ||
        expires === null
    ) {
        return null;
    }

    return {
        i: holderAid,
        fullName,
        voterId,
        precinctId,
        county,
        jurisdiction,
        electionId,
        eligible,
        expires,
    };
};

export const serializableCredentialSubjectAttributes = (
    subject: Record<string, unknown> | null
): Record<string, string | boolean> => {
    if (subject === null) {
        return {};
    }

    const entries: [string, string | boolean][] = Object.entries(
        subject
    ).flatMap(([key, value]) =>
        typeof value === 'string' || typeof value === 'boolean'
            ? [[key, value]]
            : []
    );

    return Object.fromEntries(entries);
};
