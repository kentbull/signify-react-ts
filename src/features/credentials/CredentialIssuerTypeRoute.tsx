import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { ConsolePanel, EmptyState, StatusPill } from '../../app/Console';
import {
    hasSediVoterIssueDraftErrors,
    SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME,
    validateSediVoterIssueDraft,
    type SediVoterIssueFormDraft,
} from '../../domain/credentials/sediVoterId';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import { useAppDispatch, useAppSelector } from '../../state/hooks';
import {
    selectContacts,
    selectCredentialRegistries,
    selectCredentialSchemas,
    selectIssueableCredentialTypeViews,
    selectIssuedCredentials,
    selectSelectedWalletRegistry,
} from '../../state/selectors';
import { walletRegistrySelected } from '../../state/walletSelection.slice';
import {
    readyCredentialRegistriesForIssuer,
    resolvedCredentialHolderContacts,
} from './credentialSelection';
import {
    issuedCredentialsForAidAndSchema,
    registryTilesForIssuer,
} from './credentialViewModels';
import {
    issuerPath,
    schemaStatusTone,
} from './credentialDisplay';
import { useCredentialsRouteContext } from './CredentialsRouteContext';
import {
    CredentialRegistrySelector,
    IssuedCredentialsForTypePanel,
    SediVoterIssueForm,
} from './CredentialIssuerTypePanels';

const defaultDraft: SediVoterIssueFormDraft = {
    fullName: 'Ada Voter',
    voterId: 'SEDI-0001',
    precinctId: 'PCT-042',
    county: 'Demo County',
    jurisdiction: 'SEDI',
    electionId: 'SEDI-2026-DEMO',
    eligible: true,
    expires: '2026-12-31T23:59:59Z',
};

/**
 * Issuer credential-type route.
 *
 * This route owns registry selection, SEDI issue draft state, and grant
 * commands for credentials of the selected type.
 */
export const CredentialIssuerTypeRoute = () => {
    const {
        actionRunning,
        selectedIdentifier,
        submitResolveSchema,
        submitCredentialForm,
    } = useCredentialsRouteContext();
    const { typeKey } = useParams<{ typeKey?: string }>();
    const dispatch = useAppDispatch();
    const contacts = useAppSelector(selectContacts);
    const credentialTypes = useAppSelector(selectIssueableCredentialTypeViews);
    const schemas = useAppSelector(selectCredentialSchemas);
    const registries = useAppSelector(selectCredentialRegistries);
    const issuedCredentials = useAppSelector(selectIssuedCredentials);
    const walletSelectedRegistry = useAppSelector(selectSelectedWalletRegistry);
    const [holderAid, setHolderAid] = useState('');
    const [registryName, setRegistryName] = useState(
        SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME
    );
    const [showNewRegistry, setShowNewRegistry] = useState(false);
    const [pendingRegistrySelection, setPendingRegistrySelection] = useState<{
        issuerAid: string;
        registryName: string;
    } | null>(null);
    const [draft, setDraft] = useState<SediVoterIssueFormDraft>(defaultDraft);

    const selectedType =
        credentialTypes.find((type) => type.key === typeKey) ?? null;
    const credentialTypesBySchema = new Map(
        credentialTypes.map((credentialType) => [
            credentialType.schemaSaid,
            credentialType,
        ])
    );
    const schemasBySaid = new Map(
        schemas.map((schema) => [schema.said, schema])
    );
    const resolvedHolderContacts = resolvedCredentialHolderContacts(contacts);
    const activeHolderContact =
        resolvedHolderContacts.find((contact) => contact.aid === holderAid) ??
        null;
    const registryTiles =
        selectedIdentifier === null || selectedType === null
            ? []
            : registryTilesForIssuer({
                  aid: selectedIdentifier.prefix,
                  registries,
                  issuedCredentials,
                  credentialTypes,
                  selectedSchemaSaid: selectedType.schemaSaid,
              });
    const pendingRegistry =
        selectedIdentifier === null || pendingRegistrySelection === null
            ? null
            : (readyCredentialRegistriesForIssuer(
                  registries,
                  selectedIdentifier.prefix
              ).find(
                  (registry) =>
                      registry.issuerAid ===
                          pendingRegistrySelection.issuerAid &&
                      registry.registryName ===
                          pendingRegistrySelection.registryName
              ) ?? null);

    useEffect(() => {
        if (
            pendingRegistry !== null &&
            walletSelectedRegistry?.id !== pendingRegistry.id
        ) {
            dispatch(walletRegistrySelected({ registryId: pendingRegistry.id }));
        }
    }, [dispatch, pendingRegistry, walletSelectedRegistry?.id]);

    if (selectedIdentifier === null) {
        return null;
    }
    const selectedRegistryIdForAid = registryTiles.some(
        (tile) => tile.registry.id === walletSelectedRegistry?.id
    )
        ? (walletSelectedRegistry?.id ?? '')
        : '';
    const effectiveRegistryId =
        selectedRegistryIdForAid || pendingRegistry?.id || '';
    const selectedRegistry =
        registryTiles.find((tile) => tile.registry.id === effectiveRegistryId)
            ?.registry ?? null;
    const selectedTypeIssuedCredentials =
        selectedType === null
            ? []
            : issuedCredentialsForAidAndSchema(
                  issuedCredentials,
                  selectedIdentifier.prefix,
                  selectedType.schemaSaid
              );
    const draftErrors = validateSediVoterIssueDraft(draft);
    const draftHasErrors = hasSediVoterIssueDraftErrors(draftErrors);
    const holderSelectionMessage =
        activeHolderContact !== null
            ? null
            : resolvedHolderContacts.length === 0
              ? 'No resolved non-witness holder contacts are available.'
              : holderAid.trim().length > 0
                ? 'Selected holder contact cannot receive credentials.'
                : 'Select a holder contact.';
    const issueBlockers = [
        ...(selectedType === null ? ['Select a credential type.'] : []),
        ...(selectedType !== null && selectedType.schemaStatus !== 'resolved'
            ? ['Add this credential type to the agent before issuing.']
            : []),
        ...(selectedRegistry === null
            ? [
                  registryTiles.length === 0
                      ? 'Create a registry for this AID before issuing.'
                      : 'Select a registry tile.',
              ]
            : []),
        ...(holderSelectionMessage === null ? [] : [holderSelectionMessage]),
        ...(draftHasErrors ? ['Fix the highlighted credential fields.'] : []),
    ];
    const issuerReady = issueBlockers.length === 0;

    const submitCreateRegistry = () => {
        if (registryName.trim().length === 0) {
            return;
        }

        const normalizedRegistryName = registryName.trim();
        const formData = new FormData();
        formData.set('intent', 'createRegistry');
        formData.set('issuerAlias', selectedIdentifier.name);
        formData.set('issuerAid', selectedIdentifier.prefix);
        formData.set('registryName', normalizedRegistryName);
        setPendingRegistrySelection({
            issuerAid: selectedIdentifier.prefix,
            registryName: normalizedRegistryName,
        });
        submitCredentialForm(formData);
    };

    const submitIssue = () => {
        if (
            selectedRegistry === null ||
            selectedType === null ||
            activeHolderContact === null ||
            activeHolderContact.aid === null
        ) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'issueCredential');
        formData.set('issuerAlias', selectedIdentifier.name);
        formData.set('issuerAid', selectedIdentifier.prefix);
        formData.set('holderAid', activeHolderContact.aid);
        formData.set('registryId', selectedRegistry.regk);
        formData.set('schemaSaid', selectedType.schemaSaid);
        Object.entries(draft).forEach(([key, value]) => {
            formData.set(key, String(value));
        });
        submitCredentialForm(formData);
    };

    const submitGrant = (credential: CredentialSummaryRecord) => {
        if (credential.holderAid === null) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'grantCredential');
        formData.set('issuerAlias', selectedIdentifier.name);
        formData.set('issuerAid', selectedIdentifier.prefix);
        formData.set('holderAid', credential.holderAid);
        formData.set('credentialSaid', credential.said);
        submitCredentialForm(formData);
    };

    const selectRegistry = (registryId: string) => {
        dispatch(walletRegistrySelected({ registryId }));
    };

    if (selectedType === null) {
        return (
            <Stack spacing={2}>
                <Box>
                    <Button
                        component={RouterLink}
                        to={issuerPath(selectedIdentifier.prefix)}
                        startIcon={<ArrowBackIcon />}
                        variant="outlined"
                    >
                        Back
                    </Button>
                </Box>
                <EmptyState
                    title="Credential type not found"
                    message="Choose an issueable credential type from the issuer page."
                />
            </Stack>
        );
    }

    if (selectedType.schemaStatus !== 'resolved') {
        return (
            <Stack spacing={2}>
                <Box>
                    <Button
                        component={RouterLink}
                        to={issuerPath(selectedIdentifier.prefix)}
                        startIcon={<ArrowBackIcon />}
                        variant="outlined"
                    >
                        Back
                    </Button>
                </Box>
                <ConsolePanel
                    title={selectedType.label}
                    eyebrow="Add credential type"
                    actions={
                        <StatusPill
                            label={selectedType.schemaStatus}
                            tone={schemaStatusTone(selectedType.schemaStatus)}
                        />
                    }
                >
                    <EmptyState
                        title="Credential type not added"
                        message="Add this supported schema type to the connected agent before issuing credentials of this type."
                        action={
                            <Button
                                variant="contained"
                                startIcon={<AssignmentTurnedInIcon />}
                                disabled={actionRunning}
                                onClick={() => submitResolveSchema(selectedType)}
                            >
                                Add schema type
                            </Button>
                        }
                    />
                </ConsolePanel>
            </Stack>
        );
    }

    return (
        <Stack spacing={2}>
            <Box>
                <Button
                    component={RouterLink}
                    to={issuerPath(selectedIdentifier.prefix)}
                    startIcon={<ArrowBackIcon />}
                    variant="outlined"
                >
                    Back
                </Button>
            </Box>
            <ConsolePanel
                title={selectedType.label}
                eyebrow="Issue credential"
                actions={<StatusPill label="schema known" tone="success" />}
            >
                <Stack spacing={2}>
                    <CredentialRegistrySelector
                        registryName={registryName}
                        showNewRegistry={showNewRegistry}
                        registryTiles={registryTiles}
                        effectiveRegistryId={effectiveRegistryId}
                        actionRunning={actionRunning}
                        onToggleNewRegistry={() =>
                            setShowNewRegistry((current) => !current)
                        }
                        onRegistryNameChange={setRegistryName}
                        onCreateRegistry={submitCreateRegistry}
                        onSelectRegistry={selectRegistry}
                    />
                    <SediVoterIssueForm
                        resolvedHolderContacts={resolvedHolderContacts}
                        holderAid={holderAid}
                        holderSelectionMessage={holderSelectionMessage}
                        draft={draft}
                        draftErrors={draftErrors}
                        issuerReady={issuerReady}
                        issueBlockers={issueBlockers}
                        actionRunning={actionRunning}
                        onHolderAidChange={setHolderAid}
                        onDraftChange={setDraft}
                        onIssue={submitIssue}
                    />
                </Stack>
            </ConsolePanel>
            <IssuedCredentialsForTypePanel
                credentials={selectedTypeIssuedCredentials}
                actionRunning={actionRunning}
                credentialTypesBySchema={credentialTypesBySchema}
                schemasBySaid={schemasBySaid}
                onGrant={submitGrant}
            />
        </Stack>
    );
};
