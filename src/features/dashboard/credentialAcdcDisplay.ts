import type {
    CredentialAcdcRecord,
    CredentialChainGraphNodeRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import { credentialSchemaDisplayLabel } from './dashboardDisplay';
import { schemaRuleViews, type SchemaRuleView } from './schemaRules';

export interface CredentialDataRow {
    name: string;
    label: string;
    value: string;
    description: string | null;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const stringifyValue = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (value === null) {
        return 'null';
    }

    return JSON.stringify(value, null, 2) ?? String(value);
};

const schemaSubjectProperties = (
    schema: SchemaRecord | null
): Record<string, unknown> | null => {
    const properties = schema?.properties;
    if (!isPlainRecord(properties)) {
        return null;
    }

    const subject = properties.a;
    if (isPlainRecord(subject) && isPlainRecord(subject.properties)) {
        return subject.properties;
    }

    return properties;
};

const schemaMetadataForPath = (
    schema: SchemaRecord | null,
    path: string
): Record<string, unknown> | null => {
    const properties = schemaSubjectProperties(schema);
    if (properties === null) {
        return null;
    }

    const direct = properties[path];
    if (isPlainRecord(direct)) {
        return direct;
    }

    const leaf = path.split('.').at(-1);
    if (leaf === undefined) {
        return null;
    }

    const leafMetadata = properties[leaf];
    return isPlainRecord(leafMetadata) ? leafMetadata : null;
};

const metadataText = (
    metadata: Record<string, unknown> | null,
    key: string
): string | null => {
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
};

const fallbackLabel = (path: string): string => {
    if (path === 'd') {
        return 'Subject SAID';
    }

    if (path === 'i') {
        return 'Subject AID';
    }

    if (path === 'dt') {
        return 'Issued at';
    }

    return path;
};

const flattenSubjectRows = ({
    value,
    path,
    schema,
    rows,
}: {
    value: unknown;
    path: string;
    schema: SchemaRecord | null;
    rows: CredentialDataRow[];
}) => {
    if (isPlainRecord(value)) {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            rows.push({
                name: path,
                label: fallbackLabel(path),
                value: '{}',
                description: null,
            });
            return;
        }

        for (const [key, nested] of entries) {
            flattenSubjectRows({
                value: nested,
                path: `${path}.${key}`,
                schema,
                rows,
            });
        }
        return;
    }

    if (Array.isArray(value)) {
        rows.push({
            name: path,
            label: fallbackLabel(path),
            value: stringifyValue(value),
            description: null,
        });
        return;
    }

    const metadata = schemaMetadataForPath(schema, path);
    rows.push({
        name: path,
        label: metadataText(metadata, 'title') ?? fallbackLabel(path),
        value: stringifyValue(value),
        description: metadataText(metadata, 'description'),
    });
};

/** Convert arbitrary ACDC subject data into inspectable display rows. */
export const credentialSubjectDataRows = (
    acdc: CredentialAcdcRecord | null,
    schema: SchemaRecord | null
): CredentialDataRow[] => {
    if (acdc?.subject === null || acdc?.subject === undefined) {
        return [];
    }

    const rows: CredentialDataRow[] = [];
    for (const [key, value] of Object.entries(acdc.subject)) {
        flattenSubjectRows({ value, path: key, schema, rows });
    }
    return rows;
};

/** Convert arbitrary ACDC credential rules into inspectable rows. */
export const credentialRulesRows = (
    acdc: CredentialAcdcRecord | null
): SchemaRuleView[] => schemaRuleViews(acdc?.rules);

export const credentialGraphNodeLabel = ({
    node,
    schemasBySaid,
}: {
    node: CredentialChainGraphNodeRecord;
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
}): string => {
    if (node.unresolved) {
        return 'Unresolved ACDC';
    }

    return credentialSchemaDisplayLabel(
        node.schemaSaid,
        node.schemaSaid === null
            ? null
            : (schemasBySaid.get(node.schemaSaid) ?? null)
    );
};
