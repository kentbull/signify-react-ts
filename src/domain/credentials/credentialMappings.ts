import type {
    CredentialResult,
    CredentialState,
    Registry,
    Serder,
    Schema,
} from 'signify-ts';
import type {
    CredentialAdmitNotification,
    CredentialExchangeNotificationReference,
    CredentialGrantNotification,
    CredentialIpexActivityRecord,
    CredentialSummaryRecord,
    CredentialSubjectAttributes,
    RegistryRecord,
    SchemaRecord,
} from './credentialTypes';
import {
    sediVoterAttributesFromSubject,
    serializableCredentialSubjectAttributes,
} from './sediVoterId';

export const IPEX_GRANT_EXN_ROUTE = '/ipex/grant';
export const IPEX_ADMIT_EXN_ROUTE = '/ipex/admit';
export const IPEX_GRANT_NOTIFICATION_ROUTE = '/exn/ipex/grant';
export const IPEX_ADMIT_NOTIFICATION_ROUTE = '/exn/ipex/admit';

type SerderSad = ConstructorParameters<typeof Serder>[0];

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

export const requireNonEmpty = (value: string, label: string): string => {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error(`${label} is required.`);
    }

    return normalized;
};

export const requireRecord = (
    value: unknown,
    label: string
): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${label} is missing or malformed.`);
    }

    return value;
};

export const serderSad = (value: unknown, label: string): SerderSad =>
    requireRecord(value, label) as SerderSad;

export const recordString = (
    record: Record<string, unknown>,
    key: string
): string | null => stringValue(record[key]);

export const recordDate = (
    record: Record<string, unknown>,
    key: string
): string | null => stringValue(record[key]);

export const exchangeItemsFromResponse = (raw: unknown): unknown[] => {
    if (Array.isArray(raw)) {
        return raw;
    }

    if (isRecord(raw)) {
        for (const key of ['exchanges', 'exns', 'items']) {
            const value = raw[key];
            if (Array.isArray(value)) {
                return value;
            }
        }
    }

    return [];
};

export const exchangeExn = (exchange: unknown): Record<string, unknown> =>
    requireRecord(requireRecord(exchange, 'Exchange resource').exn, 'EXN');

export const exchangeRoute = (exchange: unknown): string | null =>
    recordString(exchangeExn(exchange), 'r');

export const schemaText = (schema: Schema, key: string): string | null =>
    stringValue((schema as Record<string, unknown>)[key]);

export const schemaRules = (schema: Schema): Record<string, unknown> | null => {
    const rules = (schema as Record<string, unknown>).rules;
    return isRecord(rules) ? rules : null;
};

export const schemaRecordFromKeriaSchema = ({
    schema,
    said,
    oobi,
    updatedAt,
}: {
    schema: Schema;
    said: string;
    oobi: string | null;
    updatedAt: string;
}): SchemaRecord => ({
    said,
    oobi,
    status: 'resolved',
    title: schemaText(schema, 'title'),
    description: schemaText(schema, 'description'),
    version: schemaText(schema, 'version'),
    rules: schemaRules(schema),
    error: null,
    updatedAt,
});

export const registryString = (
    registry: Registry,
    key: string
): string | null => stringValue((registry as Record<string, unknown>)[key]);

const registryNameFromKeriaRegistry = (registry: Registry): string | null =>
    registryString(registry, 'name') ?? registryString(registry, 'registryName');

export const registryRecordFromKeriaRegistry = ({
    registry,
    issuerAlias,
    issuerAid,
    updatedAt,
}: {
    registry: Registry;
    issuerAlias: string;
    issuerAid: string;
    updatedAt: string;
}): RegistryRecord => {
    const regk = registryString(registry, 'regk');
    if (regk === null) {
        throw new Error('Credential registry is missing its registry key.');
    }

    return {
        id: regk,
        name: issuerAlias,
        registryName: registryNameFromKeriaRegistry(registry) ?? regk,
        regk,
        issuerAlias,
        issuerAid,
        status: 'ready',
        error: null,
        updatedAt,
    };
};

export const credentialSad = (
    credential: CredentialResult
): Record<string, unknown> => requireRecord(credential.sad, 'Credential SAD');

const credentialSubject = (
    credential: CredentialResult
): Record<string, unknown> | null => {
    const sad = credentialSad(credential);
    return isRecord(sad.a) ? sad.a : null;
};

export const credentialSaid = (credential: CredentialResult): string => {
    const said = recordString(credentialSad(credential), 'd');
    if (said === null) {
        throw new Error('Credential is missing its SAID.');
    }

    return said;
};

export const ipexActivityDirection = ({
    localAids,
    senderAid,
    recipientAid,
}: {
    localAids: ReadonlySet<string>;
    senderAid: string | null;
    recipientAid: string | null;
}): CredentialIpexActivityRecord['direction'] => {
    if (senderAid !== null && localAids.has(senderAid)) {
        return 'sent';
    }

    if (recipientAid !== null && localAids.has(recipientAid)) {
        return 'received';
    }

    return 'unknown';
};

const stateEventType = (state: CredentialState | null): string | null =>
    state === null ? null : stringValue((state as Record<string, unknown>).et);

export const statusFromCredentialState = (
    state: CredentialState | null,
    admitted: boolean
): CredentialSummaryRecord['status'] => {
    const eventType = stateEventType(state);
    if (eventType === 'rev') {
        return 'revoked';
    }

    return admitted ? 'admitted' : 'issued';
};

const credentialAttributesFromSubject = (
    subject: Record<string, unknown> | null
): CredentialSubjectAttributes | null => sediVoterAttributesFromSubject(subject);

export const credentialRecordFromKeriaCredential = ({
    credential,
    direction,
    status,
    grantSaid = null,
    admitSaid = null,
    notificationId = null,
    issuedAt = null,
    grantedAt = null,
    admittedAt = null,
    updatedAt = new Date().toISOString(),
    error = null,
}: {
    credential: CredentialResult;
    direction: CredentialSummaryRecord['direction'];
    status: CredentialSummaryRecord['status'];
    grantSaid?: string | null;
    admitSaid?: string | null;
    notificationId?: string | null;
    issuedAt?: string | null;
    grantedAt?: string | null;
    admittedAt?: string | null;
    updatedAt?: string;
    error?: string | null;
}): CredentialSummaryRecord => {
    const sad = credentialSad(credential);
    const subject = credentialSubject(credential);
    const said = credentialSaid(credential);

    return {
        said,
        schemaSaid: recordString(sad, 's'),
        registryId: recordString(sad, 'ri'),
        issuerAid: recordString(sad, 'i'),
        holderAid: subject === null ? null : recordString(subject, 'i'),
        direction,
        status,
        grantSaid,
        admitSaid,
        notificationId,
        issuedAt: issuedAt ?? (subject === null ? null : recordDate(subject, 'dt')),
        grantedAt,
        admittedAt,
        revokedAt: status === 'revoked' ? updatedAt : null,
        error,
        attributes: credentialAttributesFromSubject(subject),
        updatedAt,
    };
};

export const credentialGrantFromExchange = ({
    notification,
    exchange,
    localAids,
    loadedAt,
}: {
    notification: CredentialExchangeNotificationReference;
    exchange: unknown;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): CredentialGrantNotification => {
    const exn = requireRecord(
        requireRecord(exchange, 'Credential grant exchange').exn,
        'Credential grant EXN'
    );
    const route = recordString(exn, 'r');
    if (route !== IPEX_GRANT_EXN_ROUTE) {
        throw new Error(
            `Expected ${IPEX_GRANT_EXN_ROUTE} EXN, received ${route ?? 'unknown route'}.`
        );
    }

    const embeds = requireRecord(exn.e, 'Credential grant embeds');
    const acdc = requireRecord(embeds.acdc, 'Credential grant ACDC');
    const subject = isRecord(acdc.a) ? acdc.a : null;
    const grantSaid = recordString(exn, 'd') ?? notification.anchorSaid;
    const issuerAid = recordString(exn, 'i');
    const holderAid = recordString(exn, 'rp');
    const credentialSaid = recordString(acdc, 'd');
    if (
        grantSaid === null ||
        issuerAid === null ||
        holderAid === null ||
        credentialSaid === null
    ) {
        throw new Error('Credential grant EXN is missing required AIDs or SAIDs.');
    }

    const inbound =
        localAids.size === 0 || localAids.has(holderAid)
            ? 'actionable'
            : 'notForThisWallet';

    return {
        notificationId: notification.id,
        grantSaid,
        issuerAid,
        holderAid,
        credentialSaid,
        schemaSaid: recordString(acdc, 's'),
        attributes: serializableCredentialSubjectAttributes(subject),
        createdAt: recordString(exn, 'dt') ?? notification.dt ?? loadedAt,
        status: notification.read && inbound === 'actionable' ? 'admitted' : inbound,
    };
};

export const credentialAdmitFromExchange = ({
    notification,
    exchange,
    localAids,
    loadedAt,
}: {
    notification: CredentialExchangeNotificationReference;
    exchange: unknown;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): CredentialAdmitNotification => {
    const exn = requireRecord(
        requireRecord(exchange, 'Credential admit exchange').exn,
        'Credential admit EXN'
    );
    const route = recordString(exn, 'r');
    if (route !== IPEX_ADMIT_EXN_ROUTE) {
        throw new Error(
            `Expected ${IPEX_ADMIT_EXN_ROUTE} EXN, received ${route ?? 'unknown route'}.`
        );
    }

    const admitSaid = recordString(exn, 'd') ?? notification.anchorSaid;
    const holderAid = recordString(exn, 'i');
    const issuerAid = recordString(exn, 'rp');
    if (admitSaid === null || holderAid === null) {
        throw new Error('Credential admit EXN is missing required AIDs or SAIDs.');
    }

    return {
        notificationId: notification.id,
        admitSaid,
        grantSaid: recordString(exn, 'p'),
        issuerAid,
        holderAid,
        createdAt: recordString(exn, 'dt') ?? notification.dt ?? loadedAt,
        status:
            localAids.size === 0 || issuerAid === null || localAids.has(issuerAid)
                ? 'received'
                : 'notForThisWallet',
    };
};
