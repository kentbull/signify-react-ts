import type { PayloadDetailRecord } from '../../state/payloadDetails';
import type { RootState } from '../../state/store';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.flatMap((item) => {
              const text = stringValue(item);
              return text === null ? [] : [text];
          })
        : [];

const detailId = (label: string, index: number): string =>
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;

const aliasForAid = (state: RootState, aid: string): string | null => {
    const localAlias = state.identifiers.byPrefix[aid]?.name?.trim();
    if (localAlias !== undefined && localAlias.length > 0) {
        return localAlias === aid ? null : localAlias;
    }

    for (const contactId of state.contacts.ids) {
        const contact = state.contacts.byId[contactId];
        if (contact?.aid === aid) {
            const contactAlias = contact.alias.trim();
            return contactAlias.length > 0 && contactAlias !== aid
                ? contactAlias
                : null;
        }
    }

    return null;
};

const aidDisplayValue = (
    state: RootState | null,
    aid: string
): string | undefined => {
    if (state === null) {
        return undefined;
    }

    const alias = aliasForAid(state, aid);
    return alias === null ? undefined : `${alias} (${aid})`;
};

/**
 * Extract copyable OOBI values from an OOBI workflow result.
 */
export const oobiPayloadDetails = (result: unknown): PayloadDetailRecord[] => {
    if (!isRecord(result)) {
        return [];
    }

    const details: PayloadDetailRecord[] = [];
    const generatedOobis = stringArray(result.oobis);
    generatedOobis.forEach((oobi, index) => {
        details.push({
            id: detailId('generated-oobi', index),
            label: generatedOobis.length === 1 ? 'OOBI' : `OOBI ${index + 1}`,
            value: oobi,
            kind: 'oobi',
            copyable: true,
        });
    });

    const sourceOobi = stringValue(result.sourceOobi);
    if (sourceOobi !== null) {
        details.push({
            id: detailId('source-oobi', details.length),
            label: 'OOBI',
            value: sourceOobi,
            kind: 'oobi',
            copyable: true,
        });
    }

    const resolutionOobi = stringValue(result.resolutionOobi);
    if (resolutionOobi !== null && resolutionOobi !== sourceOobi) {
        details.push({
            id: detailId('resolution-oobi', details.length),
            label: 'Resolved URL',
            value: resolutionOobi,
            kind: 'oobi',
            copyable: true,
        });
    }

    const resolvedAid = stringValue(result.resolvedAid);
    if (resolvedAid !== null) {
        details.push({
            id: detailId('resolved-aid', details.length),
            label: 'AID',
            value: resolvedAid,
            kind: 'aid',
            copyable: true,
        });
    }

    return dedupeDetails(details);
};

/**
 * Extract delegation AIDs and anchor identifiers from workflow results.
 */
export const delegationPayloadDetails = (
    result: unknown,
    state: RootState | null = null
): PayloadDetailRecord[] => {
    if (!isRecord(result)) {
        return [];
    }

    const details: PayloadDetailRecord[] = [];
    const delegation = isRecord(result.delegation) ? result.delegation : result;

    const delegatorAid = stringValue(delegation.delegatorAid);
    const delegateAid = stringValue(delegation.delegateAid);
    const delegateEventSaid = stringValue(delegation.delegateEventSaid);
    const sequence = stringValue(delegation.sequence);
    const requestedAt = stringValue(delegation.requestedAt);

    if (delegatorAid !== null) {
        details.push({
            id: detailId('delegator-aid', details.length),
            label: 'Delegator AID',
            value: delegatorAid,
            displayValue: aidDisplayValue(state, delegatorAid),
            kind: 'aid',
            copyable: true,
        });
    }
    if (delegateAid !== null) {
        details.push({
            id: detailId('delegate-aid', details.length),
            label: 'Delegate AID',
            value: delegateAid,
            displayValue: aidDisplayValue(state, delegateAid),
            kind: 'aid',
            copyable: true,
        });
    }
    if (delegateEventSaid !== null) {
        details.push({
            id: detailId('delegate-event-said', details.length),
            label: 'Delegate Event SAID',
            value: delegateEventSaid,
            kind: 'text',
            copyable: true,
        });
    }
    if (sequence !== null) {
        details.push({
            id: detailId('delegation-sequence', details.length),
            label: 'Delegation Sequence',
            value: sequence,
            kind: 'text',
            copyable: true,
        });
    }
    if (requestedAt !== null) {
        details.push({
            id: detailId('delegation-requested-at', details.length),
            label: 'Request Time',
            value: requestedAt,
            kind: 'text',
            copyable: true,
        });
    }

    return dedupeDetails(details);
};

/**
 * Compose runtime payload extractors without letting `AppRuntime` inspect
 * domain-specific workflow result shapes.
 */
export const combinedPayloadDetails = (
    result: unknown,
    state: RootState
): PayloadDetailRecord[] =>
    dedupeDetails([
        ...oobiPayloadDetails(result),
        ...delegationPayloadDetails(result, state),
    ]);

const dedupeDetails = (
    details: readonly PayloadDetailRecord[]
): PayloadDetailRecord[] => {
    const seen = new Set<string>();
    return details.filter((detail) => {
        const key = `${detail.label}:${detail.value}`;
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
};
