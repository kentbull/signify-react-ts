import { useMemo, useState, type ReactNode } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Divider,
    List,
    ListItem,
    ListItemText,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Link as RouterLink } from 'react-router-dom';
import { ConsolePanel, EmptyState, PageHeader, StatusPill, TelemetryRow } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { DashboardLoaderData } from '../../app/routeData';
import type {
    CredentialAcdcRecord,
    CredentialChainGraphRecord,
    CredentialChainGraphNodeRecord,
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import {
    credentialGraphNodeLabel,
    credentialRulesRows,
    credentialSubjectDataRows,
} from './credentialAcdcDisplay';
import { schemaRuleViews } from './schemaRules';
import type { AidAliases, CredentialActivityEntry } from './dashboardViewModels';
import {
    AidValue,
    BackToDashboard,
    CopyableAbbreviation,
    CredentialTypeValue,
    DashboardWarning,
    DetailValue,
    FullAidValue,
    FullMonoValue,
} from './DashboardShared';
import {
    credentialLedgerStatus,
    credentialTypeLabel,
    displayText,
    registryDisplay,
    schemaTitle,
    timestampText,
} from './dashboardDisplay';

const RulesAccordion = ({
    title,
    count,
    children,
}: {
    title: string;
    count: number;
    children: ReactNode;
}) => (
    <Accordion
        disableGutters
        elevation={0}
        sx={{
            border: 1,
            borderColor: 'divider',
            bgcolor: 'transparent',
            '&:before': { display: 'none' },
        }}
    >
        <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`${title.replaceAll(' ', '-').toLowerCase()}-content`}
        >
            <Typography variant="subtitle2">
                {title} ({count})
            </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>{children}</AccordionDetails>
    </Accordion>
);

/**
 * Detail page for resolved credential schemas on the dashboard.
 */
export const ResolvedSchemasDetail = ({
    loaderData,
    schemas,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    schemas: readonly SchemaRecord[];
}) => (
    <Box
        sx={{ display: 'grid', gap: 2.5 }}
        data-testid="dashboard-schemas-detail"
    >
        <PageHeader
            eyebrow="Dashboard"
            title="Resolved Schemas"
            summary="Credential schema types recorded as resolved for the connected agent."
            actions={<BackToDashboard />}
        />
        {loaderData.status === 'error' && (
            <DashboardWarning message={loaderData.message} />
        )}
        <ConsolePanel title="Schemas resolved" eyebrow="Credentials">
            {schemas.length === 0 ? (
                <EmptyState
                    title="No resolved schemas"
                    message="Add a supported credential type before issuing or receiving credentials."
                    action={
                        <Button
                            component={RouterLink}
                            to="/credentials"
                            variant="contained"
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Open Credentials
                        </Button>
                    }
                />
            ) : (
                <>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer>
                            <Table
                                size="small"
                                data-testid="dashboard-schemas-table"
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Schema</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>SAID</TableCell>
                                        <TableCell>OOBI URL</TableCell>
                                        <TableCell>Version</TableCell>
                                        <TableCell>Updated</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {schemas.map((schema) => (
                                        <TableRow key={schema.said}>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {schemaTitle(schema)}
                                                </Typography>
                                                {schema.description !== null && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {schema.description}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <StatusPill
                                                    label={schema.status}
                                                    tone="success"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <DetailValue mono>
                                                    {schema.said}
                                                </DetailValue>
                                            </TableCell>
                                            <TableCell>
                                                <DetailValue mono>
                                                    {displayText(schema.oobi)}
                                                </DetailValue>
                                            </TableCell>
                                            <TableCell>
                                                {displayText(schema.version)}
                                            </TableCell>
                                            <TableCell>
                                                {timestampText(schema.updatedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                    <Stack
                        spacing={1.5}
                        sx={{ display: { xs: 'flex', md: 'none' } }}
                    >
                        {schemas.map((schema) => (
                            <Box
                                key={schema.said}
                                sx={{
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    pb: 1.5,
                                    '&:last-child': {
                                        borderBottom: 0,
                                        pb: 0,
                                    },
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <Typography variant="subtitle1">
                                        {schemaTitle(schema)}
                                    </Typography>
                                    <StatusPill
                                        label={schema.status}
                                        tone="success"
                                    />
                                </Stack>
                                <TelemetryRow
                                    label="SAID"
                                    value={schema.said}
                                    mono
                                />
                                <TelemetryRow
                                    label="OOBI URL"
                                    value={displayText(schema.oobi)}
                                    mono
                                />
                                <TelemetryRow
                                    label="Version"
                                    value={displayText(schema.version)}
                                />
                                <TelemetryRow
                                    label="Updated"
                                    value={timestampText(schema.updatedAt)}
                                />
                            </Box>
                        ))}
                    </Stack>
                </>
            )}
        </ConsolePanel>
    </Box>
);

/**
 * Mobile credential rows for issued/held dashboard detail lists.
 */
const CredentialDetailMobileRows = ({
    credentials,
    schemasBySaid,
    aidAliases,
    onOpenCredential,
}: {
    credentials: readonly CredentialSummaryRecord[];
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    aidAliases: AidAliases;
    onOpenCredential: (said: string) => void;
}) => (
    <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
        {credentials.map((credential) => (
            <Box
                key={credential.said}
                role="button"
                tabIndex={0}
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                onClick={() => onOpenCredential(credential.said)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenCredential(credential.said);
                    }
                }}
                sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    pb: 1.5,
                    '&:last-child': {
                        borderBottom: 0,
                        pb: 0,
                    },
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        mb: 1,
                    }}
                >
                    <CredentialTypeValue
                        credential={credential}
                        schemasBySaid={schemasBySaid}
                    />
                </Stack>
                <TelemetryRow
                    label="Credential SAID"
                    value={
                        <CopyableAbbreviation
                            value={credential.said}
                            label="credential SAID"
                            maxLength={20}
                        />
                    }
                />
                <TelemetryRow
                    label="Issuer AID"
                    value={
                        <AidValue
                            aid={credential.issuerAid}
                            aliases={aidAliases}
                        />
                    }
                />
                <TelemetryRow
                    label="Holder AID"
                    value={
                        <AidValue
                            aid={credential.holderAid}
                            aliases={aidAliases}
                        />
                    }
                />
            </Box>
        ))}
    </Stack>
);

/**
 * Desktop credential table for issued/held dashboard detail lists.
 */
const CredentialDetailTable = ({
    credentials,
    schemasBySaid,
    aidAliases,
    kind,
    onOpenCredential,
}: {
    credentials: readonly CredentialSummaryRecord[];
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    aidAliases: AidAliases;
    kind: 'issued' | 'held';
    onOpenCredential: (said: string) => void;
}) => (
    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <TableContainer>
            <Table
                size="small"
                data-testid={`dashboard-${kind}-credentials-table`}
            >
                <TableHead>
                    <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Issuer AID</TableCell>
                        <TableCell>Holder AID</TableCell>
                        <TableCell>Credential SAID</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {credentials.map((credential) => (
                        <TableRow
                            key={credential.said}
                            hover
                            role="button"
                            tabIndex={0}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                            onClick={() => onOpenCredential(credential.said)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onOpenCredential(credential.said);
                                }
                            }}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell>
                                <CredentialTypeValue
                                    credential={credential}
                                    schemasBySaid={schemasBySaid}
                                />
                            </TableCell>
                            <TableCell>
                                <AidValue
                                    aid={credential.issuerAid}
                                    aliases={aidAliases}
                                />
                            </TableCell>
                            <TableCell>
                                <AidValue
                                    aid={credential.holderAid}
                                    aliases={aidAliases}
                                />
                            </TableCell>
                            <TableCell>
                                <CopyableAbbreviation
                                    value={credential.said}
                                    label="credential SAID"
                                    maxLength={20}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Box>
);

/**
 * Dashboard detail page for issued or held credential inventories.
 */
export const CredentialsDetail = ({
    loaderData,
    credentials,
    schemasBySaid,
    aidAliases,
    kind,
    onOpenCredential,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    credentials: readonly CredentialSummaryRecord[];
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    aidAliases: AidAliases;
    kind: 'issued' | 'held';
    onOpenCredential: (said: string) => void;
}) => {
    const issued = kind === 'issued';
    const title = issued ? 'Issued Credentials' : 'Held Credentials';
    const emptyTitle = issued ? 'No issued credentials' : 'No held credentials';
    const emptyMessage = issued
        ? 'Credentials issued from any local AID and registry will appear here.'
        : 'Credentials admitted into this wallet will appear here.';

    return (
        <Box
            sx={{ display: 'grid', gap: 2.5 }}
            data-testid={`dashboard-${kind}-credentials-detail`}
        >
            <PageHeader
                eyebrow="Dashboard"
                title={title}
                summary={
                    issued
                        ? 'All credentials issued by this connected wallet across every registry.'
                        : 'All credentials currently held by this connected wallet.'
                }
                actions={<BackToDashboard />}
            />
            {loaderData.status === 'error' && (
                <DashboardWarning message={loaderData.message} />
            )}
            <ConsolePanel title={title} eyebrow="Credentials">
                {credentials.length === 0 ? (
                    <EmptyState
                        title={emptyTitle}
                        message={emptyMessage}
                        action={
                            <Button
                                component={RouterLink}
                                to="/credentials"
                                variant="contained"
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                            >
                                Open Credentials
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <CredentialDetailTable
                            credentials={credentials}
                            schemasBySaid={schemasBySaid}
                            aidAliases={aidAliases}
                            kind={kind}
                            onOpenCredential={onOpenCredential}
                        />
                        <CredentialDetailMobileRows
                            credentials={credentials}
                            schemasBySaid={schemasBySaid}
                            aidAliases={aidAliases}
                            onOpenCredential={onOpenCredential}
                        />
                    </>
                )}
            </ConsolePanel>
        </Box>
    );
};

/**
 * Tone-coded grant/admit activity marker for credential detail timelines.
 */
const CredentialActivityPill = ({
    entry,
}: {
    entry: CredentialActivityEntry;
}) => {
    const direction =
        entry.direction === 'sent'
            ? 'sent'
            : entry.direction === 'received'
              ? 'received'
              : 'observed';
    const kind = entry.kind === 'grant' ? 'grant' : 'admit';
    return (
        <StatusPill
            label={`${direction} ${kind}`}
            tone={entry.kind === 'admit' ? 'success' : 'info'}
        />
    );
};

/**
 * Domain data rows displayed only when the credential carries known attributes.
 */
const curatedCredentialDataRows = (
    credential: CredentialSummaryRecord
): Array<{ name: string; label: string; value: ReactNode }> => {
    if (credential.attributes === null) {
        return [];
    }

    return [
        { name: 'i', label: 'Subject AID', value: credential.attributes.i },
        { name: 'fullName', label: 'Full name', value: credential.attributes.fullName },
        { name: 'voterId', label: 'Voter ID', value: credential.attributes.voterId },
        { name: 'precinctId', label: 'Precinct ID', value: credential.attributes.precinctId },
        { name: 'county', label: 'County', value: credential.attributes.county },
        { name: 'jurisdiction', label: 'Jurisdiction', value: credential.attributes.jurisdiction },
        { name: 'electionId', label: 'Election ID', value: credential.attributes.electionId },
        { name: 'eligible', label: 'Eligible', value: credential.attributes.eligible ? 'Yes' : 'No' },
        { name: 'expires', label: 'Expires', value: credential.attributes.expires },
    ];
};

const credentialDataRows = (
    credential: CredentialSummaryRecord,
    acdc: CredentialAcdcRecord | null,
    schema: SchemaRecord | null
): Array<{
    name: string;
    label: string;
    value: ReactNode;
    description?: string | null;
}> => {
    const curated = curatedCredentialDataRows(credential);
    if (curated.length > 0) {
        return curated;
    }

    return credentialSubjectDataRows(acdc, schema).map((row) => ({
        name: row.name,
        label: row.label,
        value: row.value,
        description: row.description,
    }));
};

const graphNodeSize = { width: 190, height: 74 };

const graphNodeSx = ({
    selected,
    unresolved,
}: {
    selected: boolean;
    unresolved: boolean;
}) => ({
    position: 'absolute',
    width: graphNodeSize.width,
    minHeight: graphNodeSize.height,
    p: 1,
    borderRadius: 1,
    border: 1,
    borderStyle: unresolved ? 'dashed' : 'solid',
    borderColor: selected ? 'primary.main' : 'divider',
    bgcolor: selected ? 'rgba(110, 231, 255, 0.12)' : 'background.paper',
    color: 'text.primary',
    cursor: 'pointer',
    textAlign: 'left',
    '&:hover': {
        borderColor: 'primary.main',
        bgcolor: 'rgba(110, 231, 255, 0.08)',
    },
});

const graphLayout = (graph: CredentialChainGraphRecord) => {
    const nodesByDepth = new Map<number, CredentialChainGraphNodeRecord[]>();
    for (const node of graph.nodes) {
        nodesByDepth.set(node.depth, [...(nodesByDepth.get(node.depth) ?? []), node]);
    }

    const maxDepth = Math.max(0, ...graph.nodes.map((node) => node.depth));
    const maxRows = Math.max(1, ...Array.from(nodesByDepth.values()).map((nodes) => nodes.length));
    const columnGap = 250;
    const rowGap = 120;
    const margin = 32;
    const width = Math.max(560, margin * 2 + graphNodeSize.width + maxDepth * columnGap);
    const height = Math.max(180, margin * 2 + graphNodeSize.height + (maxRows - 1) * rowGap);
    const positions = new Map<string, { x: number; y: number }>();

    for (const [depth, nodes] of nodesByDepth) {
        const x = margin + (maxDepth - depth) * columnGap;
        const groupHeight = graphNodeSize.height + (nodes.length - 1) * rowGap;
        const startY = Math.max(margin, (height - groupHeight) / 2);
        nodes
            .slice()
            .sort((left, right) => left.said.localeCompare(right.said))
            .forEach((node, index) => {
                positions.set(node.said, { x, y: startY + index * rowGap });
            });
    }

    return { width, height, positions };
};

const CredentialNodeFacts = ({
    node,
    acdc,
    schema,
    aidAliases,
}: {
    node: CredentialChainGraphNodeRecord;
    acdc: CredentialAcdcRecord | null;
    schema: SchemaRecord | null;
    aidAliases: AidAliases;
}) => {
    const subjectRows = credentialSubjectDataRows(acdc, schema);
    const ruleRows = credentialRulesRows(acdc);
    const edgeRows = acdc?.edges ?? [];

    return (
        <Stack spacing={2}>
            <Stack spacing={0.5}>
                <TelemetryRow
                    label="Credential SAID"
                    value={<FullMonoValue value={node.said} />}
                />
                <TelemetryRow
                    label="Schema SAID"
                    value={
                        node.schemaSaid === null ? (
                            'Not available'
                        ) : (
                            <FullMonoValue value={node.schemaSaid} />
                        )
                    }
                />
                <TelemetryRow
                    label="Issuer AID"
                    value={<FullAidValue aid={node.issuerAid} aliases={aidAliases} />}
                />
                <TelemetryRow
                    label="Holder AID"
                    value={<FullAidValue aid={node.holderAid} aliases={aidAliases} />}
                />
            </Stack>
            <Divider />
            <Stack spacing={0.75}>
                <Typography variant="subtitle2">Credential data</Typography>
                {subjectRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No subject data available.
                    </Typography>
                ) : (
                    subjectRows.map((row) => (
                        <TelemetryRow
                            key={row.name}
                            label={row.label}
                            value={row.value}
                        />
                    ))
                )}
            </Stack>
            <RulesAccordion title="ACDC rules" count={ruleRows.length}>
                {ruleRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No credential rules.
                    </Typography>
                ) : (
                    ruleRows.map((row) => (
                        <TelemetryRow
                            key={row.name}
                            label={row.name}
                            value={row.value}
                        />
                    ))
                )}
            </RulesAccordion>
            <Stack spacing={0.75}>
                <Typography variant="subtitle2">Edges</Typography>
                {edgeRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No chained source credentials.
                    </Typography>
                ) : (
                    edgeRows.map((edge) => (
                        <TelemetryRow
                            key={`${edge.label}:${edge.said ?? 'missing'}`}
                            label={edge.label}
                            value={
                                edge.said === null ? (
                                    'No source SAID'
                                ) : (
                                    <FullMonoValue value={edge.said} />
                                )
                            }
                        />
                    ))
                )}
            </Stack>
        </Stack>
    );
};

const CredentialChainGraphPanel = ({
    rootSaid,
    graph,
    acdcsBySaid,
    schemasBySaid,
    aidAliases,
}: {
    rootSaid: string;
    graph: CredentialChainGraphRecord | null;
    acdcsBySaid: Readonly<Record<string, CredentialAcdcRecord>>;
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    aidAliases: AidAliases;
}) => {
    const [requestedSelectedSaid, setRequestedSelectedSaid] = useState<
        string | null
    >(null);

    const layout = useMemo(
        () => (graph === null ? null : graphLayout(graph)),
        [graph]
    );
    const selectedSaid =
        requestedSelectedSaid !== null &&
        graph?.nodes.some((node) => node.said === requestedSelectedSaid)
            ? requestedSelectedSaid
            : rootSaid;
    const selectedNode =
        graph?.nodes.find((node) => node.said === selectedSaid) ??
        graph?.nodes.find((node) => node.said === rootSaid) ??
        null;
    const selectedAcdc =
        selectedNode === null ? null : (acdcsBySaid[selectedNode.said] ?? null);
    const selectedSchema =
        selectedNode?.schemaSaid === null || selectedNode?.schemaSaid === undefined
            ? null
            : (schemasBySaid.get(selectedNode.schemaSaid) ?? null);

    return (
        <ConsolePanel title="Credential chain" eyebrow="ACDC DAG">
            {graph === null || layout === null || graph.nodes.length === 0 ? (
                <EmptyState
                    title="No credential chain"
                    message="No chained ACDC data is available for this credential."
                />
            ) : (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.4fr) minmax(360px, 0.8fr)' },
                        gap: 2,
                    }}
                >
                    <Box sx={{ overflowX: 'auto' }}>
                        <Box
                            sx={{
                                position: 'relative',
                                width: layout.width,
                                height: layout.height,
                            }}
                            data-testid="credential-chain-graph"
                        >
                            <Box
                                component="svg"
                                viewBox={`0 0 ${layout.width} ${layout.height}`}
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    width: '100%',
                                    height: '100%',
                                }}
                                aria-hidden="true"
                            >
                                <defs>
                                    <marker
                                        id="credential-chain-arrow"
                                        markerWidth="8"
                                        markerHeight="8"
                                        refX="7"
                                        refY="4"
                                        orient="auto"
                                    >
                                        <path
                                            d="M 0 0 L 8 4 L 0 8 z"
                                            fill="currentColor"
                                        />
                                    </marker>
                                </defs>
                                {graph.edges.map((edge) => {
                                    const from = layout.positions.get(edge.from);
                                    const to = layout.positions.get(edge.to);
                                    if (from === undefined || to === undefined) {
                                        return null;
                                    }

                                    const x1 = from.x + graphNodeSize.width;
                                    const y1 = from.y + graphNodeSize.height / 2;
                                    const x2 = to.x;
                                    const y2 = to.y + graphNodeSize.height / 2;
                                    const labelX = (x1 + x2) / 2;
                                    const labelY = (y1 + y2) / 2 - 8;
                                    return (
                                        <g key={edge.id}>
                                            <path
                                                d={`M ${x1} ${y1} C ${x1 + 70} ${y1}, ${x2 - 70} ${y2}, ${x2} ${y2}`}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeOpacity="0.5"
                                                markerEnd="url(#credential-chain-arrow)"
                                            />
                                            <text
                                                x={labelX}
                                                y={labelY}
                                                textAnchor="middle"
                                                fontSize="11"
                                                fill="currentColor"
                                            >
                                                {edge.label}
                                            </text>
                                        </g>
                                    );
                                })}
                            </Box>
                            {graph.nodes.map((node) => {
                                const position = layout.positions.get(node.said);
                                if (position === undefined) {
                                    return null;
                                }

                                const selected = node.said === selectedNode?.said;
                                const label = credentialGraphNodeLabel({
                                    node,
                                    schemasBySaid,
                                });
                                return (
                                    <Box
                                        key={node.said}
                                        component="button"
                                        type="button"
                                        data-testid={`credential-chain-node-${node.said}`}
                                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                                        onClick={() =>
                                            setRequestedSelectedSaid(node.said)
                                        }
                                        sx={{
                                            ...graphNodeSx({
                                                selected,
                                                unresolved: node.unresolved,
                                            }),
                                            left: position.x,
                                            top: position.y,
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 800 }}
                                            noWrap
                                        >
                                            {label}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                display: 'block',
                                                ...monoValueSx,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {node.said}
                                        </Typography>
                                        {node.said === rootSaid && (
                                            <StatusPill label="selected root" tone="info" />
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                    <Box>
                        {selectedNode === null ? (
                            <EmptyState
                                title="No selected credential"
                                message="Select a credential in the graph to inspect its data."
                            />
                        ) : (
                            <CredentialNodeFacts
                                node={selectedNode}
                                acdc={selectedAcdc}
                                schema={selectedSchema}
                                aidAliases={aidAliases}
                            />
                        )}
                    </Box>
                </Box>
            )}
        </ConsolePanel>
    );
};

/**
 * Dashboard detail page for one credential, including registry and IPEX activity.
 */
export const CredentialRecordDetail = ({
    loaderData,
    credential,
    acdc,
    chainGraph,
    acdcsBySaid,
    schemasBySaid,
    schema,
    registriesById,
    aidAliases,
    activity,
    presentationControls = null,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    credential: CredentialSummaryRecord | null;
    acdc: CredentialAcdcRecord | null;
    chainGraph: CredentialChainGraphRecord | null;
    acdcsBySaid: Readonly<Record<string, CredentialAcdcRecord>>;
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    schema: SchemaRecord | null;
    registriesById: ReadonlyMap<string, RegistryRecord>;
    aidAliases: AidAliases;
    activity: readonly CredentialActivityEntry[];
    presentationControls?: ReactNode;
}) => {
    if (credential === null) {
        return (
            <Box
                sx={{ display: 'grid', gap: 2.5 }}
                data-testid="dashboard-credential-detail"
            >
                <PageHeader
                    eyebrow="Dashboard"
                    title="Credential not found"
                    actions={<BackToDashboard />}
                />
                {loaderData.status === 'error' && (
                    <DashboardWarning message={loaderData.message} />
                )}
                <EmptyState
                    title="No credential record"
                    message="The credential is not present in this connected wallet's local inventory."
                    action={
                        <Button
                            component={RouterLink}
                            to="/dashboard/credentials/held"
                            variant="contained"
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Open Held Credentials
                        </Button>
                    }
                />
            </Box>
        );
    }

    const ledgerStatus = credentialLedgerStatus(credential);
    const dataRows = credentialDataRows(credential, acdc, schema);
    const schemaRules = schema?.rules ?? null;
    const schemaRulesRows = schemaRuleViews(schemaRules);
    const backPath =
        credential.direction === 'issued'
            ? '/dashboard/credentials/issued'
            : '/dashboard/credentials/held';

    return (
        <Box
            sx={{ display: 'grid', gap: 2.5 }}
            data-testid="dashboard-credential-detail"
        >
            <PageHeader
                eyebrow="Credential"
                title={credentialTypeLabel(credential, schema)}
                summary={credential.said}
                actions={
                    <Button
                        component={RouterLink}
                        to={backPath}
                        variant="outlined"
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        Back to {credential.direction === 'issued' ? 'Issued' : 'Held'}
                    </Button>
                }
            />
            {loaderData.status === 'error' && (
                <DashboardWarning message={loaderData.message} />
            )}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <ConsolePanel
                    title="Credential"
                    eyebrow="Inventory"
                    actions={
                        <StatusPill
                            label={ledgerStatus.label}
                            tone={ledgerStatus.tone}
                        />
                    }
                >
                    <Stack spacing={0.5}>
                        <TelemetryRow
                            label="Type"
                            value={credentialTypeLabel(credential, schema)}
                        />
                        <TelemetryRow
                            label="Credential SAID"
                            value={<FullMonoValue value={credential.said} />}
                        />
                        <TelemetryRow
                            label="Schema SAID"
                            value={
                                credential.schemaSaid === null ? (
                                    'Not available'
                                ) : (
                                    <FullMonoValue value={credential.schemaSaid} />
                                )
                            }
                        />
                        <TelemetryRow
                            label="Issuer AID"
                            value={
                                <FullAidValue
                                    aid={credential.issuerAid}
                                    aliases={aidAliases}
                                />
                            }
                        />
                        <TelemetryRow
                            label="Holder AID"
                            value={
                                <FullAidValue
                                    aid={credential.holderAid}
                                    aliases={aidAliases}
                                />
                            }
                        />
                        <TelemetryRow
                            label="Registry"
                            value={registryDisplay(credential, registriesById)}
                            mono
                        />
                        <TelemetryRow
                            label="Issued"
                            value={timestampText(credential.issuedAt)}
                        />
                        {credential.revokedAt !== null && (
                            <TelemetryRow
                                label="Revoked"
                                value={timestampText(credential.revokedAt)}
                            />
                        )}
                        {credential.error !== null && (
                            <TelemetryRow
                                label="Error"
                                value={credential.error}
                            />
                        )}
                    </Stack>
                </ConsolePanel>
                <ConsolePanel title="Credential data" eyebrow="Subject">
                    {dataRows.length === 0 ? (
                        <EmptyState
                            title="No decoded credential data"
                            message="This credential does not match a supported local data mapper."
                        />
                    ) : (
                        <Stack spacing={0.5}>
                            {dataRows.map((row) => (
                                <Stack key={row.name} spacing={0.25}>
                                    <TelemetryRow
                                        label={row.label}
                                        value={row.value}
                                    />
                                    {row.description !== null &&
                                        row.description !== undefined && (
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {row.description}
                                            </Typography>
                                        )}
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </ConsolePanel>
            </Box>
            {presentationControls !== null && (
                <ConsolePanel title="W3C Present" eyebrow="Verifier">
                    {presentationControls}
                </ConsolePanel>
            )}
            <CredentialChainGraphPanel
                rootSaid={credential.said}
                graph={chainGraph}
                acdcsBySaid={acdcsBySaid}
                schemasBySaid={schemasBySaid}
                aidAliases={aidAliases}
            />
            <ConsolePanel title="Schema rules" eyebrow="ACDC">
                <RulesAccordion title="Schema rules" count={schemaRulesRows.length}>
                    {schemaRulesRows.length === 0 ? (
                        <EmptyState
                            title="No schema rules"
                            message="The resolved schema does not include a top-level rules section."
                        />
                    ) : (
                        <TableContainer>
                            <Table size="small" aria-label="Schema rules">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Value</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {schemaRulesRows.map((rule) => (
                                        <TableRow
                                            key={rule.name}
                                            data-testid={`schema-rule-${rule.name}`}
                                        >
                                            <TableCell
                                                sx={{
                                                    width: {
                                                        xs: '42%',
                                                        md: '30%',
                                                    },
                                                    verticalAlign: 'top',
                                                    ...monoValueSx,
                                                    overflowWrap: 'anywhere',
                                                }}
                                            >
                                                {rule.name}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    verticalAlign: 'top',
                                                    overflowWrap: 'anywhere',
                                                    whiteSpace: 'pre-wrap',
                                                }}
                                            >
                                                {rule.value}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </RulesAccordion>
            </ConsolePanel>
            <ConsolePanel title="Activity log" eyebrow="IPEX">
                {activity.length === 0 ? (
                    <EmptyState
                        title="No credential activity"
                        message="Grant and admit exchange activity will appear here when available."
                    />
                ) : (
                    <List disablePadding>
                        {activity.map((entry) => (
                            <ListItem
                                key={entry.id}
                                disableGutters
                                sx={{
                                    alignItems: 'flex-start',
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    py: 1.25,
                                    '&:last-child': {
                                        borderBottom: 0,
                                    },
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            sx={{
                                                alignItems: {
                                                    xs: 'flex-start',
                                                    sm: 'center',
                                                },
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {entry.title}
                                                </Typography>
                                                <CredentialActivityPill
                                                    entry={entry}
                                                />
                                            </Stack>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {timestampText(entry.timestamp)}
                                            </Typography>
                                        </Stack>
                                    }
                                    secondary={
                                        <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                                            <TelemetryRow
                                                label="Exchange SAID"
                                                value={<FullMonoValue value={entry.said} />}
                                            />
                                            <TelemetryRow
                                                label="Sender"
                                                value={
                                                    <FullAidValue
                                                        aid={entry.primaryAid}
                                                        aliases={aidAliases}
                                                    />
                                                }
                                            />
                                            <TelemetryRow
                                                label="Recipient"
                                                value={
                                                    <FullAidValue
                                                        aid={entry.secondaryAid}
                                                        aliases={aidAliases}
                                                    />
                                                }
                                            />
                                        </Stack>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </ConsolePanel>
        </Box>
    );
};
