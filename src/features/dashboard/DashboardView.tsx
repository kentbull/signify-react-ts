import { useEffect, useMemo, useState } from 'react';
import {
    useFetcher,
    useLoaderData,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import { useAppRuntime, useAppSession } from '../../app/runtimeHooks';
import type {
    CredentialActionData,
    DashboardLoaderData,
} from '../../app/routeData';
import { submitCredentialAction } from '../../app/credentialActionSubmit';
import { useAppSelector } from '../../state/hooks';
import {
    selectContacts,
    selectCredentialAcdcsBySaid,
    selectCredentialAcdc,
    selectCredentialChainGraph,
    selectCredentialIpexActivity,
    selectCredentialRegistries,
    selectDashboardCounts,
    selectCredentialGrantNotifications,
    selectDidWebsDidsByAid,
    selectHeldCredentials,
    selectIdentifiers,
    selectIssuedCredentials,
    selectRecentAppNotifications,
    selectRecentChallenges,
    selectRecentKeriaNotifications,
    selectRecentOperations,
    selectResolvedCredentialSchemas,
    selectSession,
} from '../../state/selectors';
import { DashboardOverview } from './DashboardOverview';
import {
    CredentialRecordDetail,
    CredentialsDetail,
    ResolvedSchemasDetail,
} from './DashboardDetailViews';
import {
    buildCredentialActivity,
    buildDashboardAidAliases,
    buildDashboardRegistryMap,
    credentialDetailPath,
    dashboardModeForPath,
} from './dashboardViewModels';
import { CredentialW3CPresentationControls } from '../credentials/CredentialW3CPresentationControls';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import { selectCredentialW3CPresenter } from '../../domain/credentials/credentialPresentation';

/**
 * Route view that summarizes session health, activity, and credential inventory.
 */
export const DashboardView = () => {
    const loaderData = useLoaderData() as DashboardLoaderData;
    const fetcher = useFetcher<CredentialActionData>();
    const runtime = useAppRuntime();
    const location = useLocation();
    const navigate = useNavigate();
    const { credentialSaid = '' } = useParams();
    const runtimeSnapshot = useAppSession();
    const session = useAppSelector(selectSession);
    const counts = useAppSelector(selectDashboardCounts);
    const recentOperations = useAppSelector(selectRecentOperations(5));
    const recentKeriaNotifications = useAppSelector(
        selectRecentKeriaNotifications(5)
    );
    const recentAppNotifications = useAppSelector(
        selectRecentAppNotifications(5)
    );
    const recentChallenges = useAppSelector(selectRecentChallenges(5));
    const resolvedSchemas = useAppSelector(selectResolvedCredentialSchemas);
    const issuedCredentials = useAppSelector(selectIssuedCredentials);
    const heldCredentials = useAppSelector(selectHeldCredentials);
    const grantNotifications = useAppSelector(
        selectCredentialGrantNotifications
    );
    const selectedCredentialExchangeActivities = useAppSelector(
        selectCredentialIpexActivity(credentialSaid)
    );
    const selectedCredentialAcdc = useAppSelector(
        selectCredentialAcdc(credentialSaid)
    );
    const selectedCredentialChainGraph = useAppSelector(
        selectCredentialChainGraph(credentialSaid)
    );
    const credentialAcdcsBySaid = useAppSelector(selectCredentialAcdcsBySaid);
    const registries = useAppSelector(selectCredentialRegistries);
    const contacts = useAppSelector(selectContacts);
    const identifiers = useAppSelector(selectIdentifiers);
    const didWebsByAid = useAppSelector(selectDidWebsDidsByAid);
    const connection = runtimeSnapshot.connection;
    const w3cVerifiers =
        loaderData.status === 'blocked' ? [] : loaderData.verifiers;
    const [selectedVerifierId, setSelectedVerifierId] = useState(
        w3cVerifiers[0]?.id ?? ''
    );
    const actionRunning = fetcher.state !== 'idle';
    const connectionUrl =
        connection.status === 'connected' ? connection.client.url : null;
    const registriesById = useMemo(
        () => buildDashboardRegistryMap(registries),
        [registries]
    );
    const aidAliases = useMemo(
        () => buildDashboardAidAliases({ contacts, identifiers }),
        [contacts, identifiers]
    );
    const credentials = useMemo(
        () => [...issuedCredentials, ...heldCredentials],
        [issuedCredentials, heldCredentials]
    );
    const schemasBySaid = useMemo(
        () => new Map(resolvedSchemas.map((schema) => [schema.said, schema])),
        [resolvedSchemas]
    );
    const didWebsReadyByAid = useMemo(
        () =>
            new Map(
                Object.entries(didWebsByAid).map(([aid, did]) => [
                    aid,
                    did.loadState === 'ready' && did.did !== null,
                ])
            ),
        [didWebsByAid]
    );
    const selectedCredential = useMemo(
        () =>
            credentials.find(
                (credential) => credential.said === credentialSaid
            ) ?? null,
        [credentialSaid, credentials]
    );
    const selectedCredentialSchema = useMemo(
        () =>
            selectedCredential?.schemaSaid === null ||
            selectedCredential?.schemaSaid === undefined
                ? null
                : (resolvedSchemas.find(
                      (schema) => schema.said === selectedCredential.schemaSaid
                  ) ?? null),
        [resolvedSchemas, selectedCredential]
    );
    const selectedCredentialActivity = useMemo(
        () =>
            selectedCredential === null
                ? []
                : buildCredentialActivity({
                      credential: selectedCredential,
                      grantNotifications,
                      exchangeActivities: selectedCredentialExchangeActivities,
                  }),
        [
            grantNotifications,
            selectedCredential,
            selectedCredentialExchangeActivities,
        ]
    );
    const selectedPresentationPresenter = useMemo(
        () =>
            selectedCredential === null
                ? null
                : selectCredentialW3CPresenter(selectedCredential, identifiers),
        [identifiers, selectedCredential]
    );
    const selectedPresentationPresenterName =
        selectedPresentationPresenter?.name ?? '';
    const selectedPresentationPresenterPrefix =
        selectedPresentationPresenter?.prefix ?? '';
    useEffect(() => {
        if (
            selectedPresentationPresenterName.length === 0 ||
            selectedPresentationPresenterPrefix.length === 0
        ) {
            return undefined;
        }

        const controller = new AbortController();
        void runtime.didwebs
            .refreshIdentifierDid(
                selectedPresentationPresenterName,
                selectedPresentationPresenterPrefix,
                {
                    signal: controller.signal,
                    track: false,
                }
            )
            .catch(() => undefined);

        return () => controller.abort();
    }, [
        runtime,
        selectedPresentationPresenterName,
        selectedPresentationPresenterPrefix,
    ]);
    const openCredential = (said: string) => {
        navigate(credentialDetailPath(said));
    };
    const submitPresent = (
        credential: CredentialSummaryRecord,
        presenter: IdentifierSummary,
        verifierId: string
    ) => {
        if (verifierId.length === 0) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'presentCredential');
        formData.set('presenterAlias', presenter.name);
        formData.set('presenterAid', presenter.prefix);
        formData.set('credentialSaid', credential.said);
        formData.set('verifierId', verifierId);
        submitCredentialAction(fetcher, formData);
    };

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const mode = dashboardModeForPath(location.pathname);

    if (mode === 'schemas') {
        return (
            <ResolvedSchemasDetail
                loaderData={loaderData}
                schemas={resolvedSchemas}
            />
        );
    }

    if (mode === 'issuedCredentials') {
        return (
            <CredentialsDetail
                loaderData={loaderData}
                credentials={issuedCredentials}
                schemasBySaid={schemasBySaid}
                aidAliases={aidAliases}
                kind="issued"
                onOpenCredential={openCredential}
            />
        );
    }

    if (mode === 'heldCredentials') {
        return (
            <CredentialsDetail
                loaderData={loaderData}
                credentials={heldCredentials}
                schemasBySaid={schemasBySaid}
                aidAliases={aidAliases}
                kind="held"
                onOpenCredential={openCredential}
            />
        );
    }

    if (mode === 'credentialDetail') {
        return (
            <CredentialRecordDetail
                loaderData={loaderData}
                credential={selectedCredential}
                schema={selectedCredentialSchema}
                registriesById={registriesById}
                aidAliases={aidAliases}
                activity={selectedCredentialActivity}
                acdc={selectedCredentialAcdc}
                chainGraph={selectedCredentialChainGraph}
                acdcsBySaid={credentialAcdcsBySaid}
                schemasBySaid={schemasBySaid}
                presentationControls={
                    selectedCredential === null ? null : (
                        <CredentialW3CPresentationControls
                            credential={selectedCredential}
                            identifiers={identifiers}
                            didWebsReadyByAid={didWebsReadyByAid}
                            verifiers={w3cVerifiers}
                            selectedVerifierId={selectedVerifierId}
                            actionRunning={actionRunning}
                            onVerifierChange={setSelectedVerifierId}
                            onPresent={submitPresent}
                        />
                    )
                }
            />
        );
    }

    return (
        <DashboardOverview
            loaderData={loaderData}
            session={session}
            counts={counts}
            recentOperations={recentOperations}
            recentKeriaNotifications={recentKeriaNotifications}
            recentAppNotifications={recentAppNotifications}
            recentChallenges={recentChallenges}
            connectionUrl={connectionUrl}
        />
    );
};
