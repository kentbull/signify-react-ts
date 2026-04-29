import type {
    CredentialResult,
    CredentialState,
    Registry,
    Serder,
    Schema,
} from 'signify-ts';
import type {
    CredentialAcdcEdgeReference,
    CredentialAcdcRecord,
    CredentialChainGraphEdgeRecord,
    CredentialChainGraphNodeRecord,
    CredentialChainGraphRecord,
    CredentialAdmitNotification,
    CredentialExchangeNotificationReference,
    CredentialGrantNotification,
    CredentialIpexActivityRecord,
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from './credentialTypes';
import type { IssueableCredentialTypeRecord } from './credentialCatalog';
import {
    projectCredentialSubjectAttributes,
    serializeCredentialSubjectAttributes,
} from './credentialProjectors';

/**
 * IPEX route constants used by credential services and notification hydration.
 *
 * Keep them in the credential domain so services do not duplicate protocol
 * strings or import from feature/UI code.
 */
export const IPEX_GRANT_EXN_ROUTE = '/ipex/grant';
export const IPEX_ADMIT_EXN_ROUTE = '/ipex/admit';
export const IPEX_GRANT_NOTIFICATION_ROUTE = '/exn/ipex/grant';
export const IPEX_ADMIT_NOTIFICATION_ROUTE = '/exn/ipex/admit';

type SerderSad = ConstructorParameters<typeof Serder>[0];

/** Narrow unknown KERIA payloads to object records at SDK seams. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

/** Read a non-empty string from loose KERIA payload data. */
export const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

/** Require user/protocol text before crossing into Signify calls. */
export const requireNonEmpty = (value: string, label: string): string => {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error(`${label} is required.`);
    }

    return normalized;
};

/** Require object payloads from KERIA responses before projecting records. */
export const requireRecord = (
    value: unknown,
    label: string
): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${label} is missing or malformed.`);
    }

    return value;
};

/**
 * Build a Signify `Serder` input from unknown stored credential event data.
 */
export const serderSad = (value: unknown, label: string): SerderSad =>
    requireRecord(value, label) as SerderSad;

/** Read a string field from a loose KERIA record. */
export const recordString = (
    record: Record<string, unknown>,
    key: string
): string | null => stringValue(record[key]);

/** Read a date-like string field from a loose KERIA record. */
export const recordDate = (
    record: Record<string, unknown>,
    key: string
): string | null => stringValue(record[key]);

/**
 * Normalize the different exchange-query response envelopes KERIA may return.
 */
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

/** Extract the EXN payload from a KERIA exchange resource. */
export const exchangeExn = (exchange: unknown): Record<string, unknown> =>
    requireRecord(requireRecord(exchange, 'Exchange resource').exn, 'EXN');

/** Read the route from a KERIA exchange resource. */
export const exchangeRoute = (exchange: unknown): string | null =>
    recordString(exchangeExn(exchange), 'r');

/** Read optional display text from a resolved KERIA schema. */
export const schemaText = (schema: Schema, key: string): string | null =>
    stringValue((schema as Record<string, unknown>)[key]);

const schemaObjectBranch = (
    value: Record<string, unknown>
): Record<string, unknown> | null => {
    const oneOf = value.oneOf;
    if (!Array.isArray(oneOf)) {
        return null;
    }

    for (const candidate of oneOf) {
        if (
            isRecord(candidate) &&
            (candidate.type === 'object' || isRecord(candidate.properties))
        ) {
            return candidate;
        }
    }

    return null;
};

/** Preserve schema rules as data without cloning the full schema payload. */
export const schemaRules = (schema: Schema): Record<string, unknown> | null => {
    const rules = (schema as Record<string, unknown>).rules;
    if (isRecord(rules)) {
        return rules;
    }

    const properties = schemaProperties(schema);
    const acdcRules = properties?.r;
    if (!isRecord(acdcRules)) {
        return null;
    }

    const objectBranch = schemaObjectBranch(acdcRules);
    if (objectBranch !== null) {
        const ruleProperties = objectBranch.properties;
        return isRecord(ruleProperties) ? ruleProperties : objectBranch;
    }

    const ruleProperties = acdcRules.properties;
    return isRecord(ruleProperties) ? ruleProperties : acdcRules;
};

/** Preserve schema properties for generic ACDC data display. */
export const schemaProperties = (
    schema: Schema
): Record<string, unknown> | null => {
    const properties = (schema as Record<string, unknown>).properties;
    return isRecord(properties) ? properties : null;
};

/**
 * Project a KERIA schema response into the serializable schema state record.
 */
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
}): SchemaRecord => {
    const properties = schemaProperties(schema);
    return {
        said,
        oobi,
        status: 'resolved',
        title: schemaText(schema, 'title'),
        description: schemaText(schema, 'description'),
        credentialType: schemaText(schema, 'credentialType'),
        version: schemaText(schema, 'version'),
        ...(properties === null ? {} : { properties }),
        rules: schemaRules(schema),
        error: null,
        updatedAt,
    };
};

/** Read a string field from KERIA registry records. */
export const registryString = (
    registry: Registry,
    key: string
): string | null => stringValue((registry as Record<string, unknown>)[key]);

const registryNameFromKeriaRegistry = (registry: Registry): string | null =>
    registryString(registry, 'name') ?? registryString(registry, 'registryName');

/**
 * Project one KERIA registry into the issuer-owned registry state record.
 */
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

/** Return the raw ACDC/SAD body from a credential result. */
export const credentialSad = (
    credential: CredentialResult
): Record<string, unknown> => requireRecord(credential.sad, 'Credential SAD');

/** Return the embedded schema from a credential result when KERIA supplied it. */
export const credentialSchema = (credential: CredentialResult): Schema | null => {
    const schema = (credential as Record<string, unknown>).schema;
    return isRecord(schema) ? (schema as Schema) : null;
};

const credentialSubject = (
    credential: CredentialResult
): Record<string, unknown> | null => {
    const sad = credentialSad(credential);
    return isRecord(sad.a) ? sad.a : null;
};

const credentialRegistryId = (
    sad: Record<string, unknown>
): string | null => recordString(sad, 'ri') ?? recordString(sad, 'rd');

const credentialRules = (sad: Record<string, unknown>): unknown | null =>
    sad.r === undefined ? null : sad.r;

const credentialEdgeBlock = (sad: Record<string, unknown>): unknown | null =>
    sad.e === undefined ? null : sad.e;

/** Require the credential SAID from a KERIA credential result. */
export const credentialSaid = (credential: CredentialResult): string => {
    const said = recordString(credentialSad(credential), 'd');
    if (said === null) {
        throw new Error('Credential is missing its SAID.');
    }

    return said;
};

const isCredentialResult = (value: unknown): value is CredentialResult =>
    isRecord(value) && isRecord(value.sad);

/** Return recursive chained credentials from a KERIA credential result. */
export const credentialChains = (
    credential: CredentialResult
): CredentialResult[] => {
    const chains = (credential as Record<string, unknown>).chains;
    return Array.isArray(chains) ? chains.filter(isCredentialResult) : [];
};

const edgeOperator = (
    source: Record<string, unknown>,
    inheritedOperator: string | null
): string | null => recordString(source, 'o') ?? inheritedOperator;

const edgeSaid = (source: Record<string, unknown>): string | null =>
    recordString(source, 'n') ?? recordString(source, 'd');

const collectEdgeReferences = ({
    value,
    prefix,
    inheritedOperator,
    refs,
}: {
    value: unknown;
    prefix: string | null;
    inheritedOperator: string | null;
    refs: CredentialAcdcEdgeReference[];
}) => {
    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            collectEdgeReferences({
                value: item,
                prefix: prefix === null ? String(index) : `${prefix}.${index}`,
                inheritedOperator,
                refs,
            });
        });
        return;
    }

    if (!isRecord(value)) {
        return;
    }

    const groupOperator = recordString(value, 'o') ?? inheritedOperator;
    for (const [key, source] of Object.entries(value)) {
        if (key === 'd' || key === 'o') {
            continue;
        }

        const label = prefix === null ? key : `${prefix}.${key}`;
        if (!isRecord(source)) {
            continue;
        }

        const said = edgeSaid(source);
        refs.push({
            label,
            said,
            operator: edgeOperator(source, groupOperator),
            data: source,
        });
    }
};

/** Extract all source credential references from a raw ACDC edge block. */
export const credentialEdgeReferences = (
    sad: Record<string, unknown>
): CredentialAcdcEdgeReference[] => {
    const refs: CredentialAcdcEdgeReference[] = [];
    collectEdgeReferences({
        value: credentialEdgeBlock(sad),
        prefix: null,
        inheritedOperator: null,
        refs,
    });
    return refs;
};

/**
 * Classify IPEX activity relative to the local wallet AIDs.
 */
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

/**
 * Derive local credential lifecycle status from KERIA credential state.
 */
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

const credentialStateFromResult = (
    credential: CredentialResult
): CredentialState | null => {
    const status = (credential as Record<string, unknown>).status;
    return isRecord(status) ? (status as CredentialState) : null;
};

/**
 * Project a KERIA credential result into generic raw ACDC detail state.
 */
export const credentialAcdcRecordFromKeriaCredential = ({
    credential,
    status = null,
    updatedAt = new Date().toISOString(),
}: {
    credential: CredentialResult;
    status?: CredentialSummaryRecord['status'] | null;
    updatedAt?: string;
}): CredentialAcdcRecord => {
    const sad = credentialSad(credential);
    const subject = credentialSubject(credential);

    return {
        said: credentialSaid(credential),
        schemaSaid: recordString(sad, 's'),
        registryId: credentialRegistryId(sad),
        issuerAid: recordString(sad, 'i'),
        holderAid: subject === null ? null : recordString(subject, 'i'),
        subject,
        rules: credentialRules(sad),
        edges: credentialEdgeReferences(sad),
        status,
        updatedAt,
    };
};

/**
 * Flatten one credential plus its recursive chained credentials, de-duping by SAID.
 */
export const flattenCredentialChain = (
    credential: CredentialResult
): CredentialResult[] => {
    const bySaid = new Map<string, CredentialResult>();
    const visit = (candidate: CredentialResult) => {
        const said = credentialSaid(candidate);
        if (bySaid.has(said)) {
            return;
        }

        bySaid.set(said, candidate);
        for (const chain of credentialChains(candidate)) {
            visit(chain);
        }
    };

    visit(credential);
    return Array.from(bySaid.values());
};

const graphNodeFromAcdc = (
    acdc: CredentialAcdcRecord
): CredentialChainGraphNodeRecord => ({
    said: acdc.said,
    schemaSaid: acdc.schemaSaid,
    issuerAid: acdc.issuerAid,
    holderAid: acdc.holderAid,
    unresolved: false,
    depth: 0,
});

const unresolvedGraphNode = (
    said: string
): CredentialChainGraphNodeRecord => ({
    said,
    schemaSaid: null,
    issuerAid: null,
    holderAid: null,
    unresolved: true,
    depth: 0,
});

const assignGraphDepths = ({
    rootSaid,
    nodes,
    edges,
}: {
    rootSaid: string;
    nodes: Map<string, CredentialChainGraphNodeRecord>;
    edges: readonly CredentialChainGraphEdgeRecord[];
}) => {
    const incomingByTarget = new Map<string, CredentialChainGraphEdgeRecord[]>();
    for (const edge of edges) {
        incomingByTarget.set(edge.to, [
            ...(incomingByTarget.get(edge.to) ?? []),
            edge,
        ]);
    }

    const queue: Array<{ said: string; depth: number }> = [
        { said: rootSaid, depth: 0 },
    ];
    const bestDepth = new Map<string, number>();
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) {
            continue;
        }

        if (bestDepth.has(current.said)) {
            continue;
        }

        bestDepth.set(current.said, current.depth);
        const node = nodes.get(current.said);
        if (node !== undefined) {
            node.depth = current.depth;
        }

        for (const edge of incomingByTarget.get(current.said) ?? []) {
            queue.push({ said: edge.from, depth: current.depth + 1 });
        }
    }
};

/**
 * Normalize one root credential's source credentials into a visual DAG record.
 */
export const credentialChainGraphFromKeriaCredential = ({
    credential,
    updatedAt = new Date().toISOString(),
}: {
    credential: CredentialResult;
    updatedAt?: string;
}): CredentialChainGraphRecord => {
    const rootSaid = credentialSaid(credential);
    const credentials = flattenCredentialChain(credential);
    const acdcs = credentials.map((item) =>
        credentialAcdcRecordFromKeriaCredential({
            credential: item,
            status: statusFromCredentialState(
                credentialStateFromResult(item),
                false
            ),
            updatedAt,
        })
    );
    const nodes = new Map<string, CredentialChainGraphNodeRecord>();
    for (const acdc of acdcs) {
        nodes.set(acdc.said, graphNodeFromAcdc(acdc));
    }

    const edges: CredentialChainGraphEdgeRecord[] = [];
    const edgeIds = new Set<string>();
    for (const acdc of acdcs) {
        for (const ref of acdc.edges) {
            if (ref.said === null) {
                continue;
            }

            if (!nodes.has(ref.said)) {
                nodes.set(ref.said, unresolvedGraphNode(ref.said));
            }

            const id = `${ref.said}->${acdc.said}:${ref.label}`;
            if (edgeIds.has(id)) {
                continue;
            }

            edgeIds.add(id);
            edges.push({
                id,
                from: ref.said,
                to: acdc.said,
                label: ref.label,
                operator: ref.operator,
            });
        }
    }

    assignGraphDepths({ rootSaid, nodes, edges });

    return {
        rootSaid,
        nodes: Array.from(nodes.values()).sort(
            (left, right) =>
                right.depth - left.depth || left.said.localeCompare(right.said)
        ),
        edges,
        updatedAt,
    };
};

/**
 * Project a KERIA credential result into the app's credential summary record.
 *
 * Schema-specific subject parsing is delegated through the projector boundary
 * so generic ACDC mapping does not know about individual credential types.
 */
export const credentialRecordFromKeriaCredential = ({
    credential,
    credentialTypes,
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
    credentialTypes: readonly IssueableCredentialTypeRecord[];
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
    const schemaSaid = recordString(sad, 's');

    return {
        said,
        schemaSaid,
        registryId: credentialRegistryId(sad),
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
        attributes: projectCredentialSubjectAttributes({
            subject,
            context: { schemaSaid, credentialTypes },
        }),
        updatedAt,
    };
};

/**
 * Project an IPEX grant exchange into holder-facing notification metadata.
 */
export const credentialGrantFromExchange = ({
    notification,
    exchange,
    localAids,
    credentialTypes,
    loadedAt,
}: {
    notification: CredentialExchangeNotificationReference;
    exchange: unknown;
    localAids: ReadonlySet<string>;
    credentialTypes: readonly IssueableCredentialTypeRecord[];
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
    const schemaSaid = recordString(acdc, 's');
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
        schemaSaid,
        attributes: serializeCredentialSubjectAttributes({
            subject,
            context: { schemaSaid, credentialTypes },
        }),
        createdAt: recordString(exn, 'dt') ?? notification.dt ?? loadedAt,
        status: notification.read && inbound === 'actionable' ? 'admitted' : inbound,
    };
};

/**
 * Project an IPEX admit exchange into issuer-facing notification metadata.
 */
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
