import { useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector } from '../../state/hooks';
import {
    selectCredentialGrantNotifications,
    selectHeldCredentials,
    selectIssueableCredentialTypeViews,
} from '../../state/selectors';
import {
    grantsForAid,
    heldCredentialsForAid,
    walletStatsForAid,
} from './credentialViewModels';
import { credentialPath } from './credentialDisplay';
import { useCredentialsRouteContext } from './CredentialsRouteContext';
import {
    HeldCredentialsPanel,
    InboundGrantsPanel,
    WalletCredentialTypesPanel,
    WalletStatsPanel,
} from './CredentialWalletPanels';

/**
 * Wallet route for one selected local AID.
 *
 * This route owns holder-side schema readiness, inbound grant admission, and
 * held credential expansion state.
 */
export const CredentialWalletRoute = () => {
    const {
        actionRunning,
        selectedIdentifier,
        submitResolveSchema,
        submitCredentialForm,
    } = useCredentialsRouteContext();
    const credentialTypes = useAppSelector(selectIssueableCredentialTypeViews);
    const heldCredentials = useAppSelector(selectHeldCredentials);
    const grantNotifications = useAppSelector(selectCredentialGrantNotifications);
    const [expandedCredentialSaid, setExpandedCredentialSaid] = useState('');

    if (selectedIdentifier === null) {
        return null;
    }

    const credentialTypesBySchema = new Map(
        credentialTypes.map((credentialType) => [
            credentialType.schemaSaid,
            credentialType,
        ])
    );
    const selectedAidHeldCredentials = heldCredentialsForAid(
        heldCredentials,
        selectedIdentifier.prefix
    );
    const selectedAidGrants = grantsForAid(
        grantNotifications,
        selectedIdentifier.prefix
    );
    const walletStats = walletStatsForAid({
        aid: selectedIdentifier.prefix,
        heldCredentials,
        grants: grantNotifications,
    });
    const unresolvedWalletCredentialType =
        credentialTypes.find((type) => type.schemaStatus !== 'resolved') ?? null;

    const submitAdmit = (notificationId: string, grantSaid: string) => {
        const formData = new FormData();
        formData.set('intent', 'admitCredentialGrant');
        formData.set('holderAlias', selectedIdentifier.name);
        formData.set('holderAid', selectedIdentifier.prefix);
        formData.set('notificationId', notificationId);
        formData.set('grantSaid', grantSaid);
        submitCredentialForm(formData);
    };

    const toggleHeldCredential = (credentialSaid: string) => {
        setExpandedCredentialSaid((current) =>
            current === credentialSaid ? '' : credentialSaid
        );
    };

    return (
        <Stack spacing={2}>
            <Box>
                <Button
                    component={RouterLink}
                    to={credentialPath(selectedIdentifier.prefix)}
                    startIcon={<ArrowBackIcon />}
                    variant="outlined"
                >
                    Back
                </Button>
            </Box>
            <WalletCredentialTypesPanel
                selectedIdentifierName={selectedIdentifier.name}
                credentialTypes={credentialTypes}
                unresolvedWalletCredentialType={unresolvedWalletCredentialType}
                actionRunning={actionRunning}
                onResolveSchema={submitResolveSchema}
            />
            <WalletStatsPanel
                selectedIdentifierName={selectedIdentifier.name}
                walletStats={walletStats}
            />
            <InboundGrantsPanel
                grants={selectedAidGrants}
                actionRunning={actionRunning}
                credentialTypesBySchema={credentialTypesBySchema}
                onAdmit={submitAdmit}
            />
            <HeldCredentialsPanel
                credentials={selectedAidHeldCredentials}
                expandedCredentialSaid={expandedCredentialSaid}
                credentialTypesBySchema={credentialTypesBySchema}
                onToggleCredential={toggleHeldCredential}
            />
        </Stack>
    );
};
