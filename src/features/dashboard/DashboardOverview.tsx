import {
    Box,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ConsolePanel, EmptyState, PageHeader, StatusPill, TelemetryRow } from '../../app/Console';
import { clickablePanelSx } from '../../app/consoleStyles';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { DashboardLoaderData } from '../../app/routeData';
import type { SessionState } from '../../state/session.slice';
import type { OperationRecord } from '../../state/operations.slice';
import type { NotificationRecord } from '../../state/notifications.slice';
import type { AppNotificationRecord } from '../../state/appNotifications.slice';
import type { ChallengeRecord } from '../../state/challenges.slice';
import type { selectDashboardCounts } from '../../state/selectors';
import { timestampText } from './dashboardDisplay';
import { DashboardWarning } from './DashboardShared';

type DashboardCounts = ReturnType<typeof selectDashboardCounts>;

/**
 * Linked metric tile for dashboard inventory categories.
 */
const CountTile = ({
    label,
    value,
    to,
    testId,
}: {
    label: string;
    value: number;
    to: string;
    testId?: string;
}) => (
    <Box
        component={RouterLink}
        to={to}
        aria-label={`Open ${label}`}
        data-testid={testId}
        data-ui-sound={UI_SOUND_HOVER_VALUE}
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            px: 2,
            py: 1.75,
            minWidth: 0,
            ...clickablePanelSx,
        }}
    >
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
            {value}
        </Typography>
    </Box>
);

/**
 * Linked credential direction tile nested under the aggregate credential count.
 */
const CredentialSubTile = ({
    label,
    value,
    to,
    testId,
}: {
    label: string;
    value: number;
    to: string;
    testId: string;
}) => (
    <Box
        component={RouterLink}
        to={to}
        aria-label={`Open ${label} credentials`}
        data-testid={testId}
        data-ui-sound={UI_SOUND_HOVER_VALUE}
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'rgba(13, 23, 34, 0.72)',
            px: 1.25,
            py: 1,
            minWidth: 0,
            ...clickablePanelSx,
        }}
    >
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
        <Typography variant="h5" sx={{ mt: 0.25 }}>
            {value}
        </Typography>
    </Box>
);

/**
 * Aggregate credential tile that preserves issued and held route affordances.
 */
const CredentialsCountTile = ({
    issued,
    held,
}: {
    issued: number;
    held: number;
}) => (
    <Box
        data-testid="dashboard-credentials-tile"
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            px: 2,
            py: 1.75,
            minWidth: 0,
        }}
    >
        <Typography variant="caption" color="text.secondary">
            Credentials
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
            {issued + held}
        </Typography>
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 1,
                mt: 1.25,
            }}
        >
            <CredentialSubTile
                label="Issued"
                value={issued}
                to="/dashboard/credentials/issued"
                testId="dashboard-issued-credentials-tile"
            />
            <CredentialSubTile
                label="Held"
                value={held}
                to="/dashboard/credentials/held"
                testId="dashboard-held-credentials-tile"
            />
        </Box>
    </Box>
);

/**
 * Presentational dashboard overview.
 *
 * `DashboardView` owns selectors and mode routing; this component only renders
 * already-derived session, inventory, and activity summaries.
 */
export const DashboardOverview = ({
    loaderData,
    session,
    counts,
    recentOperations,
    recentKeriaNotifications,
    recentAppNotifications,
    recentChallenges,
    connectionUrl,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    session: SessionState;
    counts: DashboardCounts;
    recentOperations: readonly OperationRecord[];
    recentKeriaNotifications: readonly NotificationRecord[];
    recentAppNotifications: readonly AppNotificationRecord[];
    recentChallenges: readonly ChallengeRecord[];
    connectionUrl: string | null;
}) => {
    const keriaTarget = connectionUrl ?? 'Disconnected';

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }} data-testid="dashboard-view">
            <PageHeader
                eyebrow="Session"
                title="Dashboard"
                summary="Live agent inventory, operation status, credential inventory, and protocol activity for the connected KERIA session."
            />
            {loaderData.status === 'error' && (
                <DashboardWarning message={loaderData.message} />
            )}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        lg: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1.5,
                }}
            >
                <CountTile
                    label="Identifiers"
                    value={counts.identifiers}
                    to="/identifiers"
                    testId="dashboard-identifiers-tile"
                />
                <CountTile
                    label="Contacts"
                    value={counts.contacts}
                    to="/contacts"
                    testId="dashboard-contacts-tile"
                />
                <CountTile
                    label="Schemas resolved"
                    value={counts.resolvedSchemas}
                    to="/dashboard/schemas"
                    testId="dashboard-schemas-tile"
                />
                <CredentialsCountTile
                    issued={counts.issuedCredentials}
                    held={counts.heldCredentials}
                />
                <CountTile
                    label="Active operations"
                    value={counts.activeOperations}
                    to="/operations"
                />
                <CountTile
                    label="Unread KERIA notices"
                    value={counts.unreadKeriaNotifications}
                    to="/notifications"
                />
                <CountTile
                    label="Unread app notices"
                    value={counts.unreadAppNotifications}
                    to="/notifications"
                />
                <CountTile
                    label="Challenges"
                    value={counts.challenges}
                    to="/contacts"
                />
            </Box>
            <ConsolePanel title="Agent information" eyebrow="KERIA" to="/client">
                <TelemetryRow
                    label="Controller AID"
                    value={session.controllerAid ?? 'Not connected'}
                    mono
                />
                <TelemetryRow
                    label="Agent AID"
                    value={session.agentAid ?? 'Not connected'}
                    mono
                />
                <TelemetryRow
                    label="Connected"
                    value={timestampText(session.connectedAt)}
                />
                <TelemetryRow label="KERIA target" value={keriaTarget} mono />
                <TelemetryRow
                    label="Booted this session"
                    value={session.booted ? 'Yes' : 'No'}
                />
            </ConsolePanel>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <ConsolePanel
                    title="Recent operations"
                    eyebrow="Runtime"
                    to="/operations"
                >
                    {recentOperations.length === 0 ? (
                        <EmptyState
                            title="No operations"
                            message="Background workflow activity appears here."
                        />
                    ) : (
                        <List disablePadding>
                            {recentOperations.map((operation) => (
                                <ListItem
                                    key={operation.requestId}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {operation.title}
                                                </Typography>
                                                <StatusPill
                                                    label={operation.status}
                                                    tone={
                                                        operation.status ===
                                                        'error'
                                                            ? 'error'
                                                            : operation.status ===
                                                                'success'
                                                              ? 'success'
                                                              : operation.status ===
                                                                  'running'
                                                                ? 'warning'
                                                                : 'neutral'
                                                    }
                                                />
                                            </Stack>
                                        }
                                        secondary={timestampText(
                                            operation.startedAt
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
                <ConsolePanel
                    title="Protocol notifications"
                    eyebrow="KERIA"
                    to="/notifications"
                >
                    {recentKeriaNotifications.length === 0 ? (
                        <EmptyState
                            title="No protocol notifications"
                            message="KERIA inbox items appear here after sync."
                        />
                    ) : (
                        <List disablePadding>
                            {recentKeriaNotifications.map((notification) => (
                                <ListItem
                                    key={notification.id}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {notification.route}
                                                </Typography>
                                                <StatusPill
                                                    label={
                                                        notification.read
                                                            ? 'read'
                                                            : 'unread'
                                                    }
                                                    tone={
                                                        notification.read
                                                            ? 'neutral'
                                                            : 'info'
                                                    }
                                                />
                                            </Stack>
                                        }
                                        secondary={timestampText(
                                            notification.updatedAt
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
                <ConsolePanel
                    title="App notices"
                    eyebrow="Runtime"
                    to="/notifications"
                >
                    {recentAppNotifications.length === 0 ? (
                        <EmptyState
                            title="No app notices"
                            message="Completed background tasks report here."
                        />
                    ) : (
                        <List disablePadding>
                            {recentAppNotifications.map((notification) => (
                                <ListItem
                                    key={notification.id}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={notification.title}
                                        secondary={notification.message}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
                <ConsolePanel
                    title="Challenge responses"
                    eyebrow="Contacts"
                    to="/contacts"
                >
                    {recentChallenges.length === 0 ? (
                        <EmptyState
                            title="No challenge responses"
                            message="Resolved contact challenge records appear here."
                        />
                    ) : (
                        <List disablePadding>
                            {recentChallenges.map((challenge) => (
                                <ListItem
                                    key={challenge.id}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {challenge.role}
                                                </Typography>
                                                <StatusPill
                                                    label={challenge.status}
                                                    tone={
                                                        challenge.authenticated
                                                            ? 'success'
                                                            : 'warning'
                                                    }
                                                />
                                            </Stack>
                                        }
                                        secondary={timestampText(
                                            challenge.updatedAt
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
            </Box>
        </Box>
    );
};
