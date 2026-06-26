import {
    identifierDelegatorAid,
    isDelegatedIdentifier,
} from '../../domain/identifiers/delegationHelpers';
import type {
    IdentifierCreateDraft,
    IdentifierDelegationChainNode,
    IdentifierSummary,
} from '../../domain/identifiers/identifierTypes';
import type { RootState } from '../../state/store';
import type { IdentifierMutationResult } from '../../services/identifiers.service';
import {
    createIdentifierBackgroundOp,
    createIdentifierOp,
    getIdentifierDelegationChainOp,
    getIdentifierOp,
    listIdentifiersOp,
    rotateIdentifierBackgroundOp,
    rotateIdentifierOp,
} from '../../workflows/identifiers.op';
import { identifiersRoute, requestIdFrom } from './helpers';
import { delegationPayloadDetails } from './payloadDetails';
import type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RuntimeCommandContext,
    WorkflowRunOptions,
} from './types';

export interface IdentifierRuntimeCommands {
    list(options?: WorkflowRunOptions): Promise<IdentifierSummary[]>;
    get(
        aid: string,
        options?: WorkflowRunOptions
    ): Promise<IdentifierSummary>;
    getDelegationChain(
        aid: string,
        options?: WorkflowRunOptions
    ): Promise<IdentifierDelegationChainNode[]>;
    create(
        draft: IdentifierCreateDraft,
        options?: WorkflowRunOptions
    ): Promise<IdentifierSummary[]>;
    rotate(
        aid: string,
        options?: WorkflowRunOptions
    ): Promise<IdentifierSummary[]>;
    startCreate(
        draft: IdentifierCreateDraft,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startRotate(
        aid: string,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
}

/**
 * Route-facing identifier commands. Workflow files own Signify/KERIA behavior;
 * this adapter owns runtime labels, resource keys, and completion metadata.
 */
export const createIdentifierRuntimeCommands = (
    context: RuntimeCommandContext
): IdentifierRuntimeCommands => ({
    list: listIdentifiers(context),
    get: getIdentifier(context),
    getDelegationChain: getIdentifierDelegationChain(context),
    create: createIdentifier(context),
    rotate: rotateIdentifier(context),
    startCreate: startCreateIdentifier(context),
    startRotate: startRotateIdentifier(context),
});

const listIdentifiers =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<IdentifierSummary[]> =>
        context.runWorkflow(() => listIdentifiersOp(), {
            ...options,
            label: options.label ?? 'Loading identifiers...',
            kind: options.kind ?? 'listIdentifiers',
        });

const getIdentifier =
    (context: RuntimeCommandContext) =>
    (
        aid: string,
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierSummary> =>
        context.runWorkflow(() => getIdentifierOp(aid), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'listIdentifiers',
            track: options.track ?? false,
        });

const getIdentifierDelegationChain =
    (context: RuntimeCommandContext) =>
    (
        aid: string,
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierDelegationChainNode[]> =>
        context.runWorkflow(() => getIdentifierDelegationChainOp(aid), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'listIdentifiers',
            track: options.track ?? false,
        });

const createIdentifier =
    (context: RuntimeCommandContext) =>
    (
        draft: IdentifierCreateDraft,
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierSummary[]> =>
        context.runWorkflow(() => createIdentifierOp(draft), {
            ...options,
            label: options.label ?? 'Creating identifier...',
            kind: options.kind ?? 'createIdentifier',
        });

const rotateIdentifier =
    (context: RuntimeCommandContext) =>
    (
        aid: string,
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierSummary[]> =>
        context.runWorkflow(() => rotateIdentifierOp(aid), {
            ...options,
            label: options.label ?? 'Rotating identifier...',
            kind: options.kind ?? 'rotateIdentifier',
        });

const startCreateIdentifier =
    (context: RuntimeCommandContext) =>
    (
        draft: IdentifierCreateDraft,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => createIdentifierBackgroundOp(draft, requestId),
            createIdentifierOptions(draft, requestId)
        );
    };

const startRotateIdentifier =
    (context: RuntimeCommandContext) =>
    (aid: string, options: RequestIdOptions = {}): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        const identifier = identifierForRotation(context.getState(), aid);
        return context.startBackgroundWorkflow(
            () => rotateIdentifierBackgroundOp(aid, requestId),
            rotateIdentifierOptions(aid, requestId, identifier)
        );
    };

const identifierForRotation = (
    state: RootState,
    aid: string
): IdentifierSummary | null =>
    state.identifiers.byPrefix[aid] ??
    state.identifiers.prefixes
        .map((prefix) => state.identifiers.byPrefix[prefix])
        .find(
            (candidate) =>
                candidate !== undefined &&
                (candidate.name === aid || candidate.prefix === aid)
        ) ??
    null;

const createIdentifierOptions = (
    draft: IdentifierCreateDraft,
    requestId: string
): BackgroundWorkflowRunOptions<IdentifierMutationResult> => {
    const name = draft.name.trim();
    const delegated = draft.delegation.mode === 'delegated';
    const delegatorAid =
        draft.delegation.mode === 'delegated'
            ? draft.delegation.delegatorAid.trim()
            : null;

    return {
        requestId,
        label: `Creating identifier ${name}`,
        title: delegated
            ? `Create delegated identifier ${name}`
            : `Create identifier ${name}`,
        description:
            delegated && delegatorAid !== null
                ? `Creates a delegated identifier and waits for manual approval from ${delegatorAid}.`
                : 'Creates a managed identifier and waits for KERIA completion.',
        kind: delegated ? 'createDelegatedIdentifier' : 'createIdentifier',
        resourceKeys: createIdentifierResourceKeys(name, delegatorAid),
        resultRoute: identifiersRoute,
        successNotification: {
            title: delegated
                ? `Delegated identifier ${name} created`
                : `Identifier ${name} created`,
            message: delegated
                ? 'The delegator approved the request and the identifier is available.'
                : 'The identifier operation completed successfully.',
            severity: 'success',
        },
        failureNotification: {
            title: delegated
                ? `Delegated identifier ${name} failed`
                : `Identifier ${name} failed`,
            message: 'The identifier operation failed.',
            severity: 'error',
        },
        payloadDetails: delegationPayloadDetails,
    };
};

const rotateIdentifierOptions = (
    aid: string,
    requestId: string,
    identifier: IdentifierSummary | null
): BackgroundWorkflowRunOptions<IdentifierMutationResult> => {
    const delegated = isDelegatedIdentifier(identifier);
    const delegatorAid = identifierDelegatorAid(identifier);

    return {
        requestId,
        label: `Rotating identifier ${aid}`,
        title: delegated
            ? `Rotate delegated identifier ${aid}`
            : `Rotate identifier ${aid}`,
        description:
            delegated && delegatorAid !== null
                ? `Rotates a delegated identifier and waits for manual approval from ${delegatorAid}.`
                : 'Rotates a managed identifier and waits for KERIA completion.',
        kind: delegated ? 'rotateDelegatedIdentifier' : 'rotateIdentifier',
        resourceKeys: rotateIdentifierResourceKeys(aid, delegatorAid),
        resultRoute: identifiersRoute,
        successNotification: {
            title: delegated
                ? 'Delegated rotation complete'
                : 'Identifier rotation complete',
            message: delegated
                ? `The delegator approved the rotation for ${aid}.`
                : `The rotation for ${aid} completed successfully.`,
            severity: 'success',
        },
        failureNotification: {
            title: delegated
                ? 'Delegated rotation failed'
                : 'Identifier rotation failed',
            message: `The rotation for ${aid} failed.`,
            severity: 'error',
        },
        payloadDetails: delegationPayloadDetails,
    };
};

const createIdentifierResourceKeys = (
    name: string,
    delegatorAid: string | null
): string[] => [
    `identifier:name:${name}`,
    ...(delegatorAid === null
        ? []
        : [`delegation:delegator:${delegatorAid}:name:${name}`]),
];

const rotateIdentifierResourceKeys = (
    aid: string,
    delegatorAid: string | null
): string[] => [
    `identifier:aid:${aid}`,
    ...(delegatorAid === null ? [] : [`delegation:delegate:${aid}`]),
];
