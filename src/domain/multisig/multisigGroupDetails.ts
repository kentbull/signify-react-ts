import type { IdentifierSummary } from '../identifiers/identifierTypes';
import type { MultisigThresholdSith } from './multisigThresholds';

/**
 * Runtime details for a local multisig group identifier.
 *
 * The shape is derived from Signify identifier state plus `members()` response
 * data so route loaders do not import raw KERIA group-member payloads.
 */
export interface MultisigGroupDetails {
    groupAlias: string;
    groupAid: string;
    signingMemberAids: string[];
    rotationMemberAids: string[];
    signingThreshold: MultisigThresholdSith | null;
    rotationThreshold: MultisigThresholdSith | null;
    sequence: string | null;
    digest: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNestedStringArray = (value: unknown): value is string[][] =>
    Array.isArray(value) && value.every(isStringArray);

const isSithValue = (value: unknown): value is MultisigThresholdSith =>
    typeof value === 'string' ||
    typeof value === 'number' ||
    isStringArray(value) ||
    isNestedStringArray(value);

const aidValue = (entry: unknown): string | null => {
    if (!isRecord(entry)) {
        return null;
    }

    const state = isRecord(entry.state) ? entry.state : {};
    const candidates = [entry.prefix, entry.aid, state.i];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }

    return null;
};

/**
 * Extract ordered member AIDs from KERIA group member response data.
 */
export const multisigMemberAidsFromResponse = (
    response: unknown,
    role: 'signing' | 'rotation'
): string[] => {
    const record = isRecord(response) ? response : {};
    const entries = Array.isArray(record[role]) ? record[role] : [];
    const seen = new Set<string>();
    const aids: string[] = [];
    for (const entry of entries) {
        const aid = aidValue(entry);
        if (aid !== null && !seen.has(aid)) {
            seen.add(aid);
            aids.push(aid);
        }
    }
    return aids;
};

/**
 * Project a Signify group identifier and optional member response into the
 * route-loader detail shape used by multisig views.
 */
export const multisigGroupDetailsFromIdentifier = ({
    identifier,
    membersResponse,
}: {
    identifier: IdentifierSummary;
    membersResponse: unknown;
}): MultisigGroupDetails => {
    const state: Record<string, unknown> = isRecord(identifier.state)
        ? (identifier.state as Record<string, unknown>)
        : {};
    const signingMemberAids = multisigMemberAidsFromResponse(
        membersResponse,
        'signing'
    );
    const rotationMemberAids = multisigMemberAidsFromResponse(
        membersResponse,
        'rotation'
    );

    return {
        groupAlias: identifier.name,
        groupAid: identifier.prefix,
        signingMemberAids,
        rotationMemberAids:
            rotationMemberAids.length > 0
                ? rotationMemberAids
                : signingMemberAids,
        signingThreshold: isSithValue(state.kt) ? state.kt : null,
        rotationThreshold: isSithValue(state.nt) ? state.nt : null,
        sequence: typeof state.s === 'string' ? state.s : null,
        digest: typeof state.d === 'string' ? state.d : null,
    };
};
