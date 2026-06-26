import type {
    AdmitCredentialGrantInput,
    CreateCredentialRegistryInput,
    GrantCredentialInput,
    IssueSediCredentialInput,
    ResolveCredentialSchemaInput,
} from '../../domain/credentials/credentialCommands';
import type {
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import {
    admitCredentialGrantOp,
    createCredentialRegistryOp,
    grantCredentialOp,
    issueSediCredentialOp,
    resolveCredentialSchemaOp,
    syncCredentialInventoryOp,
    syncCredentialIpexActivityOp,
    syncCredentialRegistriesOp,
    syncKnownCredentialSchemasOp,
} from '../../workflows/credentials.op';
import { credentialsRoute } from './helpers';
import type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RuntimeCommandContext,
    WorkflowRunOptions,
} from './types';

export interface CredentialRuntimeCommands {
    syncInventory(options?: WorkflowRunOptions): Promise<unknown>;
    syncRegistries(options?: WorkflowRunOptions): Promise<unknown>;
    syncIpexActivity(options?: WorkflowRunOptions): Promise<unknown>;
    syncKnownSchemas(options?: WorkflowRunOptions): Promise<unknown>;
    startResolveSchema(
        input: ResolveCredentialSchemaInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startCreateRegistry(
        input: CreateCredentialRegistryInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startIssue(
        input: IssueSediCredentialInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startGrant(
        input: GrantCredentialInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startAdmit(
        input: AdmitCredentialGrantInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
}

/**
 * Route-facing credential, schema, registry, grant, and admit commands.
 */
export const createCredentialRuntimeCommands = (
    context: RuntimeCommandContext
): CredentialRuntimeCommands => ({
    syncInventory: syncCredentialInventory(context),
    syncRegistries: syncCredentialRegistries(context),
    syncIpexActivity: syncCredentialIpexActivity(context),
    syncKnownSchemas: syncKnownCredentialSchemas(context),
    startResolveSchema: startResolveCredentialSchema(context),
    startCreateRegistry: startCreateCredentialRegistry(context),
    startIssue: startIssueCredential(context),
    startGrant: startGrantCredential(context),
    startAdmit: startAdmitCredentialGrant(context),
});

const syncCredentialInventory =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncCredentialInventoryOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const syncCredentialRegistries =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncCredentialRegistriesOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const syncCredentialIpexActivity =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncCredentialIpexActivityOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const syncKnownCredentialSchemas =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncKnownCredentialSchemasOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const startResolveCredentialSchema =
    (context: RuntimeCommandContext) =>
    (
        input: ResolveCredentialSchemaInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => resolveCredentialSchemaOp(input),
            resolveCredentialSchemaOptions(input, options)
        );

const startCreateCredentialRegistry =
    (context: RuntimeCommandContext) =>
    (
        input: CreateCredentialRegistryInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => createCredentialRegistryOp(input),
            createCredentialRegistryOptions(input, options)
        );

const startIssueCredential =
    (context: RuntimeCommandContext) =>
    (
        input: IssueSediCredentialInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => issueSediCredentialOp(input),
            issueCredentialOptions(input, options)
        );

const startGrantCredential =
    (context: RuntimeCommandContext) =>
    (
        input: GrantCredentialInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => grantCredentialOp(input),
            grantCredentialOptions(input, options)
        );

const startAdmitCredentialGrant =
    (context: RuntimeCommandContext) =>
    (
        input: AdmitCredentialGrantInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => admitCredentialGrantOp(input),
            admitCredentialGrantOptions(input, options)
        );

const resolveCredentialSchemaOptions = (
    input: ResolveCredentialSchemaInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<SchemaRecord> => ({
    requestId: options.requestId,
    label: 'Adding SEDI credential type',
    title: 'Add credential type',
    description:
        'Adds the SEDI schema OOBI to this KERIA agent and records schema metadata.',
    kind: 'resolveSchema',
    resourceKeys: [`schema:${input.schemaSaid}`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential type added',
        message: 'The SEDI credential type is available to this wallet.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential type add failed',
        message: 'The SEDI credential type could not be added.',
        severity: 'error',
    },
});

const createCredentialRegistryOptions = (
    input: CreateCredentialRegistryInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<RegistryRecord> => ({
    requestId: options.requestId,
    label: `Creating registry for ${input.issuerAlias}`,
    title: 'Create credential registry',
    description:
        'Creates or reuses the issuer credential registry for SEDI voter credentials.',
    kind: 'createRegistry',
    resourceKeys: [`registry:${input.issuerAid}`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential registry ready',
        message: 'The issuer credential registry is ready.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential registry failed',
        message: 'The issuer credential registry could not be prepared.',
        severity: 'error',
    },
});

const issueCredentialOptions = (
    input: IssueSediCredentialInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<CredentialSummaryRecord> => ({
    requestId: options.requestId,
    label: `Issuing credential to ${input.holderAid}`,
    title: 'Issue SEDI voter credential',
    description:
        'Creates the ACDC in the issuer registry and waits for KERIA completion.',
    kind: 'issueCredential',
    resourceKeys: [
        `credential:issue:${input.issuerAid}:${input.holderAid}:${input.attributes.voterId}`,
    ],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential issued',
        message: 'The SEDI voter credential was issued.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential issuance failed',
        message: 'The SEDI voter credential could not be issued.',
        severity: 'error',
    },
});

const grantCredentialOptions = (
    input: GrantCredentialInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<CredentialSummaryRecord> => ({
    requestId: options.requestId,
    label: `Granting credential ${input.credentialSaid}`,
    title: 'Grant credential',
    description:
        'Sends an IPEX grant to the holder and waits for KERIA completion.',
    kind: 'grantCredential',
    resourceKeys: [`credential:${input.credentialSaid}:grant`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential grant sent',
        message: 'The credential grant was sent to the holder.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential grant failed',
        message: 'The credential grant could not be sent.',
        severity: 'error',
    },
});

const admitCredentialGrantOptions = (
    input: AdmitCredentialGrantInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<CredentialSummaryRecord> => ({
    requestId: options.requestId,
    label: `Admitting credential grant ${input.grantSaid}`,
    title: 'Admit credential grant',
    description:
        'Accepts the issuer IPEX grant and refreshes holder credential inventory.',
    kind: 'admitCredential',
    resourceKeys: [`grant:${input.grantSaid}:admit`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential admitted',
        message: 'The credential is now available in this wallet.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential admit failed',
        message: 'The credential grant could not be admitted.',
        severity: 'error',
    },
});
