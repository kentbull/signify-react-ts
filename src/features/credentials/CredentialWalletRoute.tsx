import { useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../state/hooks';
import {
    selectCredentialGrantNotifications,
    selectDidWebsDidByAid,
    selectHeldCredentials,
    selectIssueableCredentialTypeViews,
    selectCredentialSchemas,
} from '../../state/selectors';
import {
    grantsForAid,
    heldCredentialsForAid,
    walletStatsForAid,
} from './credentialViewModels';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import { credentialPath } from './credentialDisplay';
import { credentialDetailPath } from '../dashboard/dashboardViewModels';
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
 * held credential presentation/project actions.
 */
export const CredentialWalletRoute = () => {
    const navigate = useNavigate();
    const {
        actionRunning,
        selectedIdentifier,
        submitResolveSchema,
        submitCredentialForm,
        w3cVerifiers,
    } = useCredentialsRouteContext();
    const credentialTypes = useAppSelector(selectIssueableCredentialTypeViews);
    const schemas = useAppSelector(selectCredentialSchemas);
    const heldCredentials = useAppSelector(selectHeldCredentials);
    const grantNotifications = useAppSelector(selectCredentialGrantNotifications);
    const didWebsDid = useAppSelector(
        selectDidWebsDidByAid(selectedIdentifier?.prefix)
    );
    const [selectedVerifierId, setSelectedVerifierId] = useState(
        w3cVerifiers[0]?.id ?? ''
    );

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
    const selectedAidGrants = grantsForAid(
        grantNotifications,
        selectedIdentifier.prefix
    );
    const walletStats = walletStatsForAid({
        aid: selectedIdentifier.prefix,
        heldCredentials,
        grants: grantNotifications,
    });
    const effectiveVerifierId =
        w3cVerifiers.find((verifier) => verifier.id === selectedVerifierId)
            ?.id ??
        w3cVerifiers[0]?.id ??
        '';
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

    const openHeldCredential = (credentialSaid: string) => {
        navigate(credentialDetailPath(credentialSaid));
    };

    const submitProject = (credential: CredentialSummaryRecord) => {
        if (effectiveVerifierId.length === 0) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'projectCredential');
        formData.set('holderAlias', selectedIdentifier.name);
        formData.set('holderAid', selectedIdentifier.prefix);
        formData.set('credentialSaid', credential.said);
        formData.set('verifierId', effectiveVerifierId);
        submitCredentialForm(formData);
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
                schemasBySaid={schemasBySaid}
                onAdmit={submitAdmit}
            />
            <HeldCredentialsPanel
                credentials={selectedAidHeldCredentials}
                credentialTypesBySchema={credentialTypesBySchema}
                schemasBySaid={schemasBySaid}
                verifiers={w3cVerifiers}
                selectedVerifierId={effectiveVerifierId}
                didWebsReady={
                    didWebsDid?.loadState === 'ready' &&
                    didWebsDid.did !== null
                }
                actionRunning={actionRunning}
                onOpenCredential={openHeldCredential}
                onVerifierChange={setSelectedVerifierId}
                onProject={submitProject}
            />
        </Stack>
    );
};
