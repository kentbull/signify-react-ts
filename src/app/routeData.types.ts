import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import type {
    MultisigCreateDraft,
    MultisigInteractionDraft,
    MultisigRequestActionInput,
    MultisigRotationDraft,
} from '../features/multisig/multisigTypes';
import type { MultisigGroupDetails } from '../domain/multisig/multisigGroupDetails';
import type {
    OobiRole,
    ResolveContactInput,
} from '../services/contacts.service';
import type {
    GeneratedContactChallengeResult,
    GenerateContactChallengeInput,
    RespondToContactChallengeInput,
    SendChallengeRequestInput,
    VerifyContactChallengeInput,
} from '../workflows/challenges.op';
import type { DismissExchangeNotificationInput } from '../workflows/notifications.op';
import type { ApproveDelegationInput } from '../workflows/delegations.op';
import type {
    AdmitCredentialGrantInput,
    CreateCredentialRegistryInput,
    GrantCredentialInput,
    IssueSediCredentialInput,
    ResolveCredentialSchemaInput,
} from '../workflows/credentials.op';
import type {
    ConnectedSignifyClient,
    SignifyClientConfig,
    SignifyStateSummary,
} from '../signify/client';
import type { BackgroundWorkflowStartResult } from './runtime';

/**
 * Canonical route used for startup redirects, unknown paths, and successful
 * KERIA connection submissions.
 */
export const DEFAULT_APP_PATH = '/dashboard';

/**
 * Loader result used when a connected Signify client is required.
 */
export type BlockedRouteData = { status: 'blocked' };

/**
 * Loader data for the identifiers route.
 *
 * Identifier list failures are represented as `status: "error"` instead of a
 * thrown route error because the page can still render actionable diagnostic
 * text and keep the user in the connected shell.
 */
export type IdentifiersLoaderData =
    | { status: 'ready'; identifiers: IdentifierSummary[] }
    | { status: 'error'; identifiers: IdentifierSummary[]; message: string }
    | BlockedRouteData;

/**
 * Loader data for `/dashboard`.
 */
export type DashboardLoaderData =
    | { status: 'ready' }
    | { status: 'error'; message: string }
    | BlockedRouteData;

/**
 * Loader data for `/contacts`.
 */
export type ContactsLoaderData =
    | { status: 'ready' }
    | { status: 'error'; message: string }
    | BlockedRouteData;

/**
 * Loader data for `/notifications` and notification detail routes.
 */
export type NotificationsLoaderData =
    | { status: 'ready'; identifiers: IdentifierSummary[] }
    | { status: 'error'; identifiers: IdentifierSummary[]; message: string }
    | BlockedRouteData;

export type { MultisigGroupDetails } from '../domain/multisig/multisigGroupDetails';

/**
 * Loader data for `/multisig`.
 */
export type MultisigLoaderData =
    | {
          status: 'ready';
          identifiers: IdentifierSummary[];
          groupDetails: MultisigGroupDetails[];
      }
    | {
          status: 'error';
          identifiers: IdentifierSummary[];
          groupDetails: MultisigGroupDetails[];
          message: string;
      }
    | BlockedRouteData;

/**
 * Loader data for the client summary route.
 */
export type ClientLoaderData =
    | { status: 'ready'; summary: SignifyStateSummary }
    | BlockedRouteData;

/**
 * Loader data for the credentials route.
 */
export type CredentialsLoaderData =
    | { status: 'ready' }
    | { status: 'error'; message: string }
    | BlockedRouteData;

/**
 * Typed action result for root-level shell actions.
 *
 * Successful connect submissions return a React Router redirect, so this type
 * only models recoverable failures that should render inside the dialog.
 */
export type RootActionData =
    | { intent: 'connect'; ok: false; message: string }
    | { intent: 'generatePasscode'; ok: true; passcode: string }
    | { intent: 'generatePasscode'; ok: false; message: string }
    | { intent: 'unsupported'; ok: false; message: string };

/**
 * Typed action result for identifier mutations.
 */
export type IdentifierActionData =
    | {
          intent: 'create' | 'rotate';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent: 'create' | 'rotate' | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Typed action result for contact/OOBI mutations.
 */
export type ContactActionData =
    | {
          intent:
              | 'resolve'
              | 'generateOobi'
              | 'respondChallenge'
              | 'verifyChallenge'
              | 'dismissExchangeNotification'
              | 'approveDelegationRequest'
              | 'delete'
              | 'updateAlias';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent: 'generateChallenge';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
          challenge: GeneratedContactChallengeResult;
      }
    | {
          intent:
              | 'resolve'
              | 'generateOobi'
              | 'generateChallenge'
              | 'respondChallenge'
              | 'verifyChallenge'
              | 'dismissExchangeNotification'
              | 'approveDelegationRequest'
              | 'delete'
              | 'updateAlias'
              | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Typed action result for credential workflow commands.
 */
export type CredentialActionData =
    | {
          intent:
              | 'resolveSchema'
              | 'createRegistry'
              | 'issueCredential'
              | 'grantCredential'
              | 'admitCredentialGrant'
              | 'refreshCredentials';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent:
              | 'resolveSchema'
              | 'createRegistry'
              | 'issueCredential'
              | 'grantCredential'
              | 'admitCredentialGrant'
              | 'refreshCredentials'
              | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Typed action result for multisig group workflows.
 */
export type MultisigActionData =
    | {
          intent:
              | 'create'
              | 'acceptInception'
              | 'joinInception'
              | 'authorizeAgents'
              | 'acceptEndRole'
              | 'interact'
              | 'acceptInteraction'
              | 'rotate'
              | 'acceptRotation'
              | 'joinRotation';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent:
              | 'create'
              | 'acceptInception'
              | 'joinInception'
              | 'authorizeAgents'
              | 'acceptEndRole'
              | 'interact'
              | 'acceptInteraction'
              | 'rotate'
              | 'acceptRotation'
              | 'joinRotation'
              | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Minimal connected-client shape route data needs for diagnostics.
 */
interface RouteClient {
    /** KERIA admin URL shown in identifier-loader failure guidance. */
    url?: string;
}

/**
 * Runtime surface consumed by route loaders and actions.
 *
 * The interface is narrower than `AppRuntime` so loader/action unit tests can
 * use cheap fakes and so route-data code cannot reach unrelated session
 * internals by accident.
 */
export interface RouteDataRuntime {
    /** Return the connected client shape, or `null` when disconnected. */
    getClient(): RouteClient | null;
    /** Return the latest normalized Signify state, or `null` when disconnected. */
    getState(): SignifyStateSummary | null;
    /** Connect and publish runtime connection state. */
    connect(
        config: SignifyClientConfig,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<ConnectedSignifyClient | null>;
    /** Generate a Signify passcode after Signify WASM readiness completes. */
    generatePasscode(options?: { signal?: AbortSignal }): Promise<string>;
    /** Refresh the normalized Signify state through the connected client. */
    refreshState(options?: {
        signal?: AbortSignal;
    }): Promise<SignifyStateSummary | null>;
    /** Load and normalize identifiers through the connected client. */
    listIdentifiers(options?: {
        signal?: AbortSignal;
    }): Promise<IdentifierSummary[]>;
    /** Load member and threshold details for one multisig group identifier. */
    getMultisigGroupDetails(
        identifier: IdentifierSummary,
        options?: { signal?: AbortSignal }
    ): Promise<MultisigGroupDetails>;
    /** Load live contact, challenge, and protocol notification facts. */
    syncSessionInventory(options?: { signal?: AbortSignal }): Promise<unknown>;
    /** Load holder-side credential inventory. */
    syncCredentialInventory(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Load issuer-side credential registry inventory. */
    syncCredentialRegistries(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Load credential-linked IPEX exchange activity. */
    syncCredentialIpexActivity(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Detect app-supported schemas the connected agent already knows. */
    syncKnownCredentialSchemas(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Create an identifier and wait for its KERIA operation to complete. */
    createIdentifier(
        draft: IdentifierCreateDraft,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<IdentifierSummary[]>;
    /** Rotate an identifier and wait for its KERIA operation to complete. */
    rotateIdentifier(
        aid: string,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<IdentifierSummary[]>;
    /** Start identifier creation in the background. */
    startCreateIdentifier(
        draft: IdentifierCreateDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start identifier rotation in the background. */
    startRotateIdentifier(
        aid: string,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start multisig group inception in the background. */
    startCreateMultisigGroup(
        draft: MultisigCreateDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig inception request in the background. */
    startAcceptMultisigInception(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Authorize member agent endpoints for a multisig group. */
    startAuthorizeMultisigAgents(
        input: { groupAlias: string; localMemberName?: string | null },
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig endpoint role request in the background. */
    startAcceptMultisigEndRole(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start a multisig interaction in the background. */
    startInteractMultisigGroup(
        draft: MultisigInteractionDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig interaction request in the background. */
    startAcceptMultisigInteraction(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start a multisig rotation in the background. */
    startRotateMultisigGroup(
        draft: MultisigRotationDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig rotation request in the background. */
    startAcceptMultisigRotation(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Join a multisig group through a rotation request. */
    startJoinMultisigRotation(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start OOBI generation in the background. */
    startGenerateOobi(
        input: { identifier: string; role: OobiRole },
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start contact OOBI resolution in the background. */
    startResolveContact(
        input: ResolveContactInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start contact deletion in the background. */
    startDeleteContact(
        contactId: string,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start contact alias update in the background. */
    startUpdateContactAlias(
        input: { contactId: string; alias: string },
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Generate challenge words and record them in session state. */
    generateContactChallenge(
        input: GenerateContactChallengeInput,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<GeneratedContactChallengeResult>;
    /** Start challenge response sending in the background. */
    startRespondToChallenge(
        input: RespondToContactChallengeInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start challenge request notification sending in the background. */
    startSendChallengeRequest(
        input: SendChallengeRequestInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start challenger-side verification in the background. */
    startVerifyContactChallenge(
        input: VerifyContactChallengeInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Locally tombstone and optionally delete a KERIA notification note. */
    dismissExchangeNotification(
        input: DismissExchangeNotificationInput,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<void>;
    /** Start manual delegation approval in the background. */
    startApproveDelegation(
        input: ApproveDelegationInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start adding the SEDI credential schema type in the background. */
    startResolveCredentialSchema(
        input: ResolveCredentialSchemaInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start issuer registry creation in the background. */
    startCreateCredentialRegistry(
        input: CreateCredentialRegistryInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start issuer-side credential issuance in the background. */
    startIssueCredential(
        input: IssueSediCredentialInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start issuer-side IPEX grant in the background. */
    startGrantCredential(
        input: GrantCredentialInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start holder-side IPEX grant admit in the background. */
    startAdmitCredentialGrant(
        input: AdmitCredentialGrantInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
}
