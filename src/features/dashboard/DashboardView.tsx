import { useMemo } from 'react';
import {
    Navigate,
    useLoaderData,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import { useAppSession } from '../../app/runtimeHooks';
import type { DashboardLoaderData } from '../../app/routeData';
import { useAppSelector } from '../../state/hooks';
import {
    selectContacts,
    selectDashboardCounts,
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
    CredentialsDetail,
    ResolvedSchemasDetail,
} from './DashboardDetailViews';
import {
    buildDashboardAidAliases,
    canonicalCredentialWorkflowPath,
    dashboardModeForPath,
    legacyDashboardCredentialRedirectPath,
} from './dashboardViewModels';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';

/**
 * Route view that summarizes session health, activity, and credential inventory.
 */
export const DashboardView = () => {
    const loaderData = useLoaderData() as DashboardLoaderData;
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
    const contacts = useAppSelector(selectContacts);
    const identifiers = useAppSelector(selectIdentifiers);
    const connection = runtimeSnapshot.connection;
    const connectionUrl =
        connection.status === 'connected' ? connection.client.url : null;
    const aidAliases = useMemo(
        () => buildDashboardAidAliases({ contacts, identifiers }),
        [contacts, identifiers]
    );
    const schemasBySaid = useMemo(
        () => new Map(resolvedSchemas.map((schema) => [schema.said, schema])),
        [resolvedSchemas]
    );
    const openCredential = (credential: CredentialSummaryRecord) => {
        navigate(canonicalCredentialWorkflowPath(credential) ?? '/credentials');
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
            <Navigate
                to={legacyDashboardCredentialRedirectPath({
                    credentialSaid,
                    heldCredentials,
                    issuedCredentials,
                })}
                replace
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
