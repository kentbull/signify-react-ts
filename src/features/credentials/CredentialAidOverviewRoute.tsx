import {
    Box,
    Button,
    Grid,
    Stack,
    Typography,
} from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import { StatusPill } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { useAppSelector } from '../../state/hooks';
import {
    selectCredentialGrantNotifications,
    selectCredentialSchemas,
    selectHeldCredentials,
    selectIssueableCredentialTypeViews,
    selectIssuedCredentials,
} from '../../state/selectors';
import {
    heldCredentialsForAid,
    issuerStatsForAid,
    walletStatsForAid,
} from './credentialViewModels';
import {
    issuerPath,
    schemaStatusTone,
    walletPath,
} from './credentialDisplay';
import {
    OverviewChoiceCard,
    OverviewMetric,
    WalletStackPreview,
} from './CredentialShared';
import { useCredentialsRouteContext } from './CredentialsRouteContext';

/**
 * Credentials selected-AID overview route.
 *
 * This route chooses between issuer and wallet workflows; child routes own the
 * actual issuer, wallet, registry, issue, grant, and admit controls.
 */
export const CredentialAidOverviewRoute = () => {
    const {
        actionRunning,
        selectedIdentifier,
        submitResolveSchema,
    } = useCredentialsRouteContext();
    const navigate = useNavigate();
    const credentialTypes = useAppSelector(selectIssueableCredentialTypeViews);
    const schemas = useAppSelector(selectCredentialSchemas);
    const issuedCredentials = useAppSelector(selectIssuedCredentials);
    const heldCredentials = useAppSelector(selectHeldCredentials);
    const grantNotifications = useAppSelector(selectCredentialGrantNotifications);

    if (selectedIdentifier === null) {
        return null;
    }

    const credentialTypesBySchema = new Map(
        credentialTypes.map((credentialType) => [
            credentialType.schemaSaid,
            credentialType,
        ])
    );
    const schemasBySaid = new Map(
        schemas.map((schema) => [schema.said, schema])
    );
    const selectedAidHeldCredentials = heldCredentialsForAid(
        heldCredentials,
        selectedIdentifier.prefix
    );
    const issuerStats = issuerStatsForAid({
        aid: selectedIdentifier.prefix,
        credentialTypes,
        issuedCredentials,
    });
    const walletStats = walletStatsForAid({
        aid: selectedIdentifier.prefix,
        heldCredentials,
        grants: grantNotifications,
    });
    const unresolvedWalletCredentialType =
        credentialTypes.find((type) => type.schemaStatus !== 'resolved') ?? null;

    return (
        <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
                <OverviewChoiceCard
                    title="Issuer"
                    eyebrow={selectedIdentifier.name}
                    icon={<AssignmentTurnedInIcon />}
                    status={`${issuerStats.issued} issued`}
                    statusTone={
                        issuerStats.issued > 0 ? 'success' : 'neutral'
                    }
                    onOpen={() =>
                        navigate(issuerPath(selectedIdentifier.prefix))
                    }
                    testId="credential-issuer-card"
                >
                    <Stack spacing={2}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr 1fr',
                                    sm: 'repeat(3, minmax(0, 1fr))',
                                },
                                gap: 1.5,
                            }}
                        >
                            <OverviewMetric
                                label="Issuable"
                                value={String(issuerStats.issueableTypes)}
                            />
                            <OverviewMetric
                                label="Issued"
                                value={String(issuerStats.issued)}
                            />
                            <OverviewMetric
                                label="Granted"
                                value={String(issuerStats.granted)}
                            />
                        </Box>
                        <Typography variant="body2" sx={monoValueSx}>
                            {selectedIdentifier.prefix}
                        </Typography>
                    </Stack>
                </OverviewChoiceCard>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <OverviewChoiceCard
                    title="Wallet"
                    eyebrow={selectedIdentifier.name}
                    icon={<AccountBalanceWalletOutlinedIcon />}
                    status={
                        walletStats.pendingGrants > 0
                            ? `${walletStats.pendingGrants} pending`
                            : `${walletStats.admitted} admitted`
                    }
                    statusTone={
                        walletStats.pendingGrants > 0
                            ? 'info'
                            : walletStats.admitted > 0
                              ? 'success'
                              : 'neutral'
                    }
                    onOpen={() =>
                        navigate(walletPath(selectedIdentifier.prefix))
                    }
                    actions={
                        unresolvedWalletCredentialType === null ? null : (
                            <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                disabled={
                                    actionRunning ||
                                    unresolvedWalletCredentialType.schemaStatus ===
                                        'resolving'
                                }
                                onClick={() =>
                                    submitResolveSchema(
                                        unresolvedWalletCredentialType
                                    )
                                }
                            >
                                Add schema type
                            </Button>
                        )
                    }
                    testId="credential-wallet-card"
                >
                    <Stack spacing={2}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr 1fr',
                                    sm: 'repeat(3, minmax(0, 1fr))',
                                },
                                gap: 1.5,
                            }}
                        >
                            <OverviewMetric
                                label="Held types"
                                value={String(walletStats.heldTypes)}
                            />
                            <OverviewMetric
                                label="Admitted"
                                value={String(walletStats.admitted)}
                            />
                            <OverviewMetric
                                label="Present"
                                value={String(walletStats.presentationGrants)}
                            />
                        </Box>
                        {credentialTypes.length > 0 && (
                            <Stack
                                direction="row"
                                spacing={1}
                                sx={{
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <Typography variant="body2">
                                    Credential type readiness
                                </Typography>
                                <StatusPill
                                    label={
                                        unresolvedWalletCredentialType === null
                                            ? 'resolved'
                                            : unresolvedWalletCredentialType.schemaStatus
                                    }
                                    tone={
                                        unresolvedWalletCredentialType === null
                                            ? 'success'
                                            : schemaStatusTone(
                                                  unresolvedWalletCredentialType.schemaStatus
                                              )
                                    }
                                />
                            </Stack>
                        )}
                        <WalletStackPreview
                            credentials={selectedAidHeldCredentials}
                            credentialTypesBySchema={credentialTypesBySchema}
                            schemasBySaid={schemasBySaid}
                        />
                    </Stack>
                </OverviewChoiceCard>
            </Grid>
        </Grid>
    );
};
