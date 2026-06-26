import type { ReactNode } from 'react';
import {
    Box,
    Button,
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
import { Link as RouterLink } from 'react-router-dom';
import { ConsolePanel, EmptyState, PageHeader, StatusPill, TelemetryRow } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { DashboardLoaderData } from '../../app/routeData';
import type {
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
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
    aidAliases,
    onOpenCredential,
}: {
    credentials: readonly CredentialSummaryRecord[];
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
                    <CredentialTypeValue credential={credential} />
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
    aidAliases,
    kind,
    onOpenCredential,
}: {
    credentials: readonly CredentialSummaryRecord[];
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
                                <CredentialTypeValue credential={credential} />
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
    aidAliases,
    kind,
    onOpenCredential,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    credentials: readonly CredentialSummaryRecord[];
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
                            aidAliases={aidAliases}
                            kind={kind}
                            onOpenCredential={onOpenCredential}
                        />
                        <CredentialDetailMobileRows
                            credentials={credentials}
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
const credentialDataRows = (
    credential: CredentialSummaryRecord
): Array<{ label: string; value: ReactNode }> => {
    if (credential.attributes === null) {
        return [];
    }

    return [
        { label: 'Subject AID', value: credential.attributes.i },
        { label: 'Full name', value: credential.attributes.fullName },
        { label: 'Voter ID', value: credential.attributes.voterId },
        { label: 'Precinct ID', value: credential.attributes.precinctId },
        { label: 'County', value: credential.attributes.county },
        { label: 'Jurisdiction', value: credential.attributes.jurisdiction },
        { label: 'Election ID', value: credential.attributes.electionId },
        { label: 'Eligible', value: credential.attributes.eligible ? 'Yes' : 'No' },
        { label: 'Expires', value: credential.attributes.expires },
    ];
};

/**
 * Dashboard detail page for one credential, including registry and IPEX activity.
 */
export const CredentialRecordDetail = ({
    loaderData,
    credential,
    schema,
    registriesById,
    aidAliases,
    activity,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    credential: CredentialSummaryRecord | null;
    schema: SchemaRecord | null;
    registriesById: ReadonlyMap<string, RegistryRecord>;
    aidAliases: AidAliases;
    activity: readonly CredentialActivityEntry[];
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
    const dataRows = credentialDataRows(credential);
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
                title={credentialTypeLabel(credential)}
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
                            value={credentialTypeLabel(credential)}
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
                                <TelemetryRow
                                    key={row.label}
                                    label={row.label}
                                    value={row.value}
                                />
                            ))}
                        </Stack>
                    )}
                </ConsolePanel>
            </Box>
            <ConsolePanel title="Schema rules" eyebrow="ACDC">
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
                                                width: { xs: '42%', md: '30%' },
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
