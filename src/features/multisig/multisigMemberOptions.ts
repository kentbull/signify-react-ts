import type { ContactRecord } from '../../state/contacts.slice';
import { isWitnessContact } from '../../domain/contacts/contactHelpers';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import {
    thresholdSpecForMembers,
    validateThresholdSpecForMembers,
    type MultisigThresholdSpec,
} from '../../domain/multisig/multisigThresholds';
import type {
    MultisigMemberDraft,
    MultisigMemberOption,
} from '../../domain/multisig/multisigTypes';

/**
 * Return non-empty unique values while preserving first-seen order.
 */
export const unique = (values: readonly string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const trimmed = value.trim();
        if (trimmed.length > 0 && !seen.has(trimmed)) {
            seen.add(trimmed);
            result.push(trimmed);
        }
    }
    return result;
};

/**
 * Identify local group AIDs so they are not offered as multisig members.
 */
export const isGroupIdentifier = (identifier: IdentifierSummary): boolean =>
    'group' in identifier;

/**
 * Detect contact records that represent groups instead of individual members.
 */
const isGroupContact = (contact: ContactRecord): boolean =>
    contact.componentTags.includes('group') ||
    contact.oobi?.includes('groupId=') === true ||
    contact.oobi?.includes('groupName=') === true;

const hasAgentEndpoint = (contact: ContactRecord): boolean =>
    contact.endpoints.some((endpoint) => endpoint.role === 'agent');

/**
 * User-facing delivery readiness label for a candidate multisig member.
 */
export const memberDeliveryLabel = (
    status: MultisigMemberOption['deliveryStatus']
): string => {
    switch (status) {
        case 'local':
            return 'Local';
        case 'ready':
            return 'Ready';
        case 'missingAgentOobi':
            return 'Missing agent OOBI';
        case 'unresolvedContact':
            return 'Unresolved contact';
        case 'missingKeyState':
            return 'Missing key state';
    }
};

/**
 * Console pill tone for multisig member delivery readiness.
 */
export const memberDeliveryTone = (
    status: MultisigMemberOption['deliveryStatus']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
    if (status === 'local') {
        return 'info';
    }
    if (status === 'ready') {
        return 'success';
    }
    return 'warning';
};

/**
 * True when the member can receive multisig protocol messages now.
 */
export const isDeliverableMember = (option: MultisigMemberOption): boolean =>
    option.deliveryStatus === 'local' || option.deliveryStatus === 'ready';

/**
 * Build local/contact member options from wallet inventory.
 *
 * Witnesses, existing group contacts, unresolved contacts, and contacts
 * without agent endpoints are kept out of ready member submission paths.
 */
export const memberOptionsFromInventory = (
    identifiers: readonly IdentifierSummary[],
    contacts: readonly ContactRecord[]
): MultisigMemberOption[] => {
    const options: MultisigMemberOption[] = [];
    const seen = new Set<string>();

    for (const identifier of identifiers) {
        if (isGroupIdentifier(identifier) || seen.has(identifier.prefix)) {
            continue;
        }
        seen.add(identifier.prefix);
        options.push({
            aid: identifier.prefix,
            alias: `${identifier.name} (local)`,
            source: 'local',
            isGroup: false,
            isLocal: true,
            localName: identifier.name,
            deliveryStatus: 'local',
        });
    }

    for (const contact of contacts) {
        if (
            contact.aid === null ||
            seen.has(contact.aid) ||
            isWitnessContact(contact) ||
            isGroupContact(contact)
        ) {
            continue;
        }

        seen.add(contact.aid);
        const deliveryStatus =
            contact.resolutionStatus !== 'resolved'
                ? 'unresolvedContact'
                : hasAgentEndpoint(contact)
                  ? 'ready'
                  : 'missingAgentOobi';
        options.push({
            aid: contact.aid,
            alias: `${contact.alias} (contact)`,
            source: 'contact',
            isGroup: false,
            isLocal: false,
            deliveryStatus,
        });
    }

    return options.sort((left, right) => {
        if (left.isLocal !== right.isLocal) {
            return left.isLocal ? -1 : 1;
        }
        return left.alias.localeCompare(right.alias);
    });
};

/**
 * Convert selected member AIDs into the draft shape expected by multisig commands.
 */
export const memberDrafts = (
    aids: readonly string[],
    options: readonly MultisigMemberOption[]
): MultisigMemberDraft[] =>
    aids.map((aid) => {
        const option = options.find((candidate) => candidate.aid === aid);
        return {
            aid,
            alias: option?.alias ?? aid,
            source: option?.source ?? 'manual',
            isGroup: option?.isGroup,
            deliveryStatus: option?.deliveryStatus,
        };
    });

/**
 * Keep a threshold spec only when it is still valid for the selected AIDs.
 */
export const specForAids = (
    spec: MultisigThresholdSpec,
    aids: readonly string[]
): MultisigThresholdSpec =>
    validateThresholdSpecForMembers({ spec, memberAids: aids }) === null
        ? spec
        : thresholdSpecForMembers(aids);

/**
 * Read known key-state values from local group identifiers without widening the route type.
 */
export const groupStateValue = (
    group: IdentifierSummary,
    key: 's' | 'd'
): string | null => {
    const value = (group.state as Record<string, unknown> | undefined)?.[key];
    return typeof value === 'string' ? value : null;
};
