import {
    Box,
    Button,
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
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    TelemetryRow,
} from '../../app/Console';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { DashboardLoaderData } from '../../app/routeData';
import type {
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import type { AidAliases } from './dashboardViewModels';
import {
    AidValue,
    BackToDashboard,
    CopyableAbbreviation,
    CredentialTypeValue,
    DashboardWarning,
    DetailValue,
} from './DashboardShared';
import { displayText, timestampText } from './dashboardDisplay';

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
                                                <Typography
                                                    sx={{ fontWeight: 800 }}
                                                >
                                                    {displayText(schema.title)}
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {displayText(
                                                        schema.credentialType
                                                    )}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{schema.status}</TableCell>
                                            <TableCell>
                                                <CopyableAbbreviation
                                                    value={schema.said}
                                                    label="schema SAID"
                                                />
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
                                                {timestampText(
                                                    schema.updatedAt
                                                )}
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
                                <Typography sx={{ fontWeight: 800 }}>
                                    {displayText(schema.title)}
                                </Typography>
                                <TelemetryRow label="Status" value={schema.status} />
                                <TelemetryRow
                                    label="SAID"
                                    value={
                                        <CopyableAbbreviation
                                            value={schema.said}
                                            label="schema SAID"
                                        />
                                    }
                                />
                                <TelemetryRow
                                    label="OOBI"
                                    value={
                                        <DetailValue mono>
                                            {displayText(schema.oobi)}
                                        </DetailValue>
                                    }
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

const CredentialDetailMobileRows = ({
    credentials,
    schemasBySaid,
    aidAliases,
    onOpenCredential,
}: {
    credentials: readonly CredentialSummaryRecord[];
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    aidAliases: AidAliases;
    onOpenCredential: (credential: CredentialSummaryRecord) => void;
}) => (
    <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
        {credentials.map((credential) => (
            <Box
                key={credential.said}
                role="button"
                tabIndex={0}
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                onClick={() => onOpenCredential(credential)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenCredential(credential);
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
    onOpenCredential: (credential: CredentialSummaryRecord) => void;
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
                            onClick={() => onOpenCredential(credential)}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                ) {
                                    event.preventDefault();
                                    onOpenCredential(credential);
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
    onOpenCredential: (credential: CredentialSummaryRecord) => void;
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
