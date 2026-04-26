import {
    identifierDelegatorAid,
    isDelegatedIdentifier,
} from '../../domain/identifiers/delegationHelpers';
import type {
    IdentifierCreateDraft,
    IdentifierDelegationChainNode,
    IdentifierSummary,
} from '../../domain/identifiers/identifierTypes';
import {
    createIdentifierBackgroundOp,
    createIdentifierOp,
    getIdentifierDelegationChainOp,
    getIdentifierOp,
    listIdentifiersOp,
    rotateIdentifierBackgroundOp,
    rotateIdentifierOp,
} from '../../workflows/identifiers.op';
import { delegationPayloadDetails } from './payloadDetails';
import type {
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
    list: (options = {}) =>
        context.runWorkflow(() => listIdentifiersOp(), {
            ...options,
            label: options.label ?? 'Loading identifiers...',
            kind: options.kind ?? 'listIdentifiers',
        }),

    get: (aid, options = {}) =>
        context.runWorkflow(() => getIdentifierOp(aid), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'listIdentifiers',
            track: options.track ?? false,
        }),

    getDelegationChain: (aid, options = {}) =>
        context.runWorkflow(() => getIdentifierDelegationChainOp(aid), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'listIdentifiers',
            track: options.track ?? false,
        }),

    create: (draft, options = {}) =>
        context.runWorkflow(() => createIdentifierOp(draft), {
            ...options,
            label: options.label ?? 'Creating identifier...',
            kind: options.kind ?? 'createIdentifier',
        }),

    rotate: (aid, options = {}) =>
        context.runWorkflow(() => rotateIdentifierOp(aid), {
            ...options,
            label: options.label ?? 'Rotating identifier...',
            kind: options.kind ?? 'rotateIdentifier',
        }),

    startCreate: (draft, options = {}) => {
        const name = draft.name.trim();
        const delegated = draft.delegation.mode === 'delegated';
        const requestId = options.requestId ?? context.createRequestId();
        const delegatorAid =
            draft.delegation.mode === 'delegated'
                ? draft.delegation.delegatorAid.trim()
                : null;

        return context.startBackgroundWorkflow(
            () => createIdentifierBackgroundOp(draft, requestId),
            {
                requestId,
                label: `Creating identifier ${name}`,
                title: delegated
                    ? `Create delegated identifier ${name}`
                    : `Create identifier ${name}`,
                description:
                    delegated && delegatorAid !== null
                        ? `Creates a delegated identifier and waits for manual approval from ${delegatorAid}.`
                        : 'Creates a managed identifier and waits for KERIA completion.',
                kind: delegated
                    ? 'createDelegatedIdentifier'
                    : 'createIdentifier',
                resourceKeys: [
                    `identifier:name:${name}`,
                    ...(delegatorAid === null
                        ? []
                        : [
                              `delegation:delegator:${delegatorAid}:name:${name}`,
                          ]),
                ],
                resultRoute: {
                    label: 'View identifiers',
                    path: '/identifiers',
                },
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
            }
        );
    },

    startRotate: (aid, options = {}) => {
        const state = context.getState();
        const identifier =
            state.identifiers.byPrefix[aid] ??
            state.identifiers.prefixes
                .map((prefix) => state.identifiers.byPrefix[prefix])
                .find(
                    (candidate) =>
                        candidate !== undefined &&
                        (candidate.name === aid || candidate.prefix === aid)
                ) ??
            null;
        const delegated = isDelegatedIdentifier(identifier);
        const delegatorAid = identifierDelegatorAid(identifier);
        const requestId = options.requestId ?? context.createRequestId();

        return context.startBackgroundWorkflow(
            () => rotateIdentifierBackgroundOp(aid, requestId),
            {
                requestId,
                label: `Rotating identifier ${aid}`,
                title: delegated
                    ? `Rotate delegated identifier ${aid}`
                    : `Rotate identifier ${aid}`,
                description:
                    delegated && delegatorAid !== null
                        ? `Rotates a delegated identifier and waits for manual approval from ${delegatorAid}.`
                        : 'Rotates a managed identifier and waits for KERIA completion.',
                kind: delegated
                    ? 'rotateDelegatedIdentifier'
                    : 'rotateIdentifier',
                resourceKeys: [
                    `identifier:aid:${aid}`,
                    ...(delegatorAid === null
                        ? []
                        : [`delegation:delegate:${aid}`]),
                ],
                resultRoute: {
                    label: 'View identifiers',
                    path: '/identifiers',
                },
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
            }
        );
    },
});
