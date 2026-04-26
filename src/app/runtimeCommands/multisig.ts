import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { MultisigGroupDetails } from '../../domain/multisig/multisigGroupDetails';
import type {
    MultisigCreateDraft,
    MultisigInteractionDraft,
    MultisigOperationResult,
    MultisigRequestActionInput,
    MultisigRotationDraft,
} from '../../domain/multisig/multisigTypes';
import {
    acceptMultisigEndRoleOp,
    acceptMultisigInceptionOp,
    acceptMultisigInteractionOp,
    acceptMultisigRotationOp,
    authorizeMultisigAgentsOp,
    createMultisigGroupOp,
    getMultisigGroupDetailsOp,
    interactMultisigGroupOp,
    joinMultisigRotationOp,
    rotateMultisigGroupOp,
} from '../../workflows/multisig.op';
import { multisigRoute, requestIdFrom } from './helpers';
import type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RuntimeCommandContext,
    WorkflowRunOptions,
} from './types';

export interface MultisigRuntimeCommands {
    getGroupDetails(
        identifier: IdentifierSummary,
        options?: WorkflowRunOptions
    ): Promise<MultisigGroupDetails>;
    startCreateGroup(
        draft: MultisigCreateDraft,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startAcceptInception(
        input: MultisigRequestActionInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startAuthorizeAgents(
        input: { groupAlias: string; localMemberName?: string | null },
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startAcceptEndRole(
        input: MultisigRequestActionInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startInteractGroup(
        draft: MultisigInteractionDraft,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startAcceptInteraction(
        input: MultisigRequestActionInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startRotateGroup(
        draft: MultisigRotationDraft,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startAcceptRotation(
        input: MultisigRequestActionInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startJoinRotation(
        input: MultisigRequestActionInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
}

/**
 * Route-facing multisig group and proposal commands.
 */
export const createMultisigRuntimeCommands = (
    context: RuntimeCommandContext
): MultisigRuntimeCommands => ({
    getGroupDetails: getMultisigGroupDetails(context),
    startCreateGroup: startCreateMultisigGroup(context),
    startAcceptInception: startAcceptMultisigInception(context),
    startAuthorizeAgents: startAuthorizeMultisigAgents(context),
    startAcceptEndRole: startAcceptMultisigEndRole(context),
    startInteractGroup: startInteractMultisigGroup(context),
    startAcceptInteraction: startAcceptMultisigInteraction(context),
    startRotateGroup: startRotateMultisigGroup(context),
    startAcceptRotation: startAcceptMultisigRotation(context),
    startJoinRotation: startJoinMultisigRotation(context),
});

const getMultisigGroupDetails =
    (context: RuntimeCommandContext) =>
    (
        identifier: IdentifierSummary,
        options: WorkflowRunOptions = {}
    ): Promise<MultisigGroupDetails> =>
        context.runWorkflow(() => getMultisigGroupDetailsOp(identifier), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'listIdentifiers',
            track: options.track ?? false,
        });

const startCreateMultisigGroup =
    (context: RuntimeCommandContext) =>
    (
        draft: MultisigCreateDraft,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => createMultisigGroupOp(draft, requestId),
            createMultisigGroupOptions(draft, requestId)
        );
    };

const startAcceptMultisigInception =
    (context: RuntimeCommandContext) =>
    (
        input: MultisigRequestActionInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => acceptMultisigInceptionOp(input, requestId),
            acceptMultisigInceptionOptions(input, requestId)
        );
    };

const startAuthorizeMultisigAgents =
    (context: RuntimeCommandContext) =>
    (
        input: { groupAlias: string; localMemberName?: string | null },
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => authorizeMultisigAgentsOp(input, requestId),
            authorizeMultisigAgentsOptions(input, requestId)
        );
    };

const startAcceptMultisigEndRole =
    (context: RuntimeCommandContext) =>
    (
        input: MultisigRequestActionInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => acceptMultisigEndRoleOp(input, requestId),
            acceptMultisigEndRoleOptions(input, requestId)
        );
    };

const startInteractMultisigGroup =
    (context: RuntimeCommandContext) =>
    (
        draft: MultisigInteractionDraft,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => interactMultisigGroupOp(draft, requestId),
            interactMultisigGroupOptions(draft, requestId)
        );
    };

const startAcceptMultisigInteraction =
    (context: RuntimeCommandContext) =>
    (
        input: MultisigRequestActionInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => acceptMultisigInteractionOp(input, requestId),
            acceptMultisigInteractionOptions(input, requestId)
        );
    };

const startRotateMultisigGroup =
    (context: RuntimeCommandContext) =>
    (
        draft: MultisigRotationDraft,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => rotateMultisigGroupOp(draft, requestId),
            rotateMultisigGroupOptions(draft, requestId)
        );
    };

const startAcceptMultisigRotation =
    (context: RuntimeCommandContext) =>
    (
        input: MultisigRequestActionInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => acceptMultisigRotationOp(input, requestId),
            acceptMultisigRotationOptions(input, requestId)
        );
    };

const startJoinMultisigRotation =
    (context: RuntimeCommandContext) =>
    (
        input: MultisigRequestActionInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const requestId = requestIdFrom(context, options);
        return context.startBackgroundWorkflow(
            () => joinMultisigRotationOp(input, requestId),
            joinMultisigRotationOptions(input, requestId)
        );
    };

const createMultisigGroupOptions = (
    draft: MultisigCreateDraft,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => {
    const groupAlias = draft.groupAlias.trim();
    return {
        requestId,
        label: `Creating multisig group ${groupAlias}`,
        title: `Create multisig group ${groupAlias}`,
        description:
            'Creates the local group inception event, sends member invitations, and waits for KERIA completion.',
        kind: 'createMultisigGroup',
        resourceKeys: [
            `multisig:group:${groupAlias}`,
            `identifier:aid:${draft.localMemberAid}`,
        ],
        resultRoute: multisigRoute,
        successNotification: {
            title: 'Multisig inception complete',
            message: `${groupAlias} exists. Authorize group agents before using agent OOBIs.`,
            severity: 'success',
        },
        failureNotification: {
            title: 'Multisig inception failed',
            message: `${groupAlias} could not be created.`,
            severity: 'error',
        },
    };
};

const acceptMultisigInceptionOptions = (
    input: MultisigRequestActionInput,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => ({
    requestId,
    label: `Joining multisig group ${input.groupAlias}`,
    title: 'Join multisig group',
    description:
        'Recreates the proposed group inception event and sends this member signature to the group.',
    kind: 'acceptMultisigInception',
    resourceKeys: multisigProposalResourceKeys(input),
    resultRoute: multisigRoute,
    successNotification: {
        title: 'Joined multisig group',
        message: `${input.groupAlias} exists locally. Authorize group agents before using agent OOBIs.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'Multisig join failed',
        message: `${input.groupAlias} could not be joined.`,
        severity: 'error',
    },
});

const authorizeMultisigAgentsOptions = (
    input: { groupAlias: string; localMemberName?: string | null },
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => {
    const groupAlias = input.groupAlias.trim();
    return {
        requestId,
        label: `Authorizing agents for ${groupAlias}`,
        title: 'Authorize multisig agents',
        description:
            'Signs endpoint role authorizations for member agents and sends them to the group.',
        kind: 'authorizeMultisigAgent',
        resourceKeys: [`multisig:group:${groupAlias}:agents`],
        resultRoute: multisigRoute,
        successNotification: {
            title: 'Multisig agents authorized',
            message: `${groupAlias} can publish usable agent OOBIs.`,
            severity: 'success',
        },
        failureNotification: {
            title: 'Agent authorization failed',
            message: `${groupAlias} agent authorization failed.`,
            severity: 'error',
        },
    };
};

const acceptMultisigEndRoleOptions = (
    input: MultisigRequestActionInput,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => ({
    requestId,
    label: `Approving multisig role for ${input.groupAlias}`,
    title: 'Approve multisig endpoint role',
    description:
        'Signs the proposed endpoint role authorization and sends it to group members.',
    kind: 'approveMultisigEndRole',
    resourceKeys: multisigProposalResourceKeys(input, 'agents'),
    resultRoute: multisigRoute,
    successNotification: {
        title: 'Multisig role approved',
        message: `${input.groupAlias} endpoint role was approved.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'Role approval failed',
        message: `${input.groupAlias} endpoint role approval failed.`,
        severity: 'error',
    },
});

const interactMultisigGroupOptions = (
    draft: MultisigInteractionDraft,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => {
    const groupAlias = draft.groupAlias.trim();
    return {
        requestId,
        label: `Interacting with multisig group ${groupAlias}`,
        title: 'Create multisig interaction',
        description:
            'Creates a group interaction event and sends it to the other members.',
        kind: 'interactMultisigGroup',
        resourceKeys: [`multisig:group:${groupAlias}:event`],
        resultRoute: multisigRoute,
        successNotification: {
            title: 'Multisig interaction complete',
            message: `${groupAlias} interaction completed.`,
            severity: 'success',
        },
        failureNotification: {
            title: 'Multisig interaction failed',
            message: `${groupAlias} interaction failed.`,
            severity: 'error',
        },
    };
};

const acceptMultisigInteractionOptions = (
    input: MultisigRequestActionInput,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => ({
    requestId,
    label: `Accepting multisig interaction ${input.groupAlias}`,
    title: 'Accept multisig interaction',
    description:
        'Joins the proposed group interaction event and sends this member signature.',
    kind: 'acceptMultisigInteraction',
    resourceKeys: multisigProposalResourceKeys(input, 'event'),
    resultRoute: multisigRoute,
    successNotification: {
        title: 'Multisig interaction accepted',
        message: `${input.groupAlias} interaction was accepted.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'Interaction acceptance failed',
        message: `${input.groupAlias} interaction acceptance failed.`,
        severity: 'error',
    },
});

const rotateMultisigGroupOptions = (
    draft: MultisigRotationDraft,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => {
    const groupAlias = draft.groupAlias.trim();
    return {
        requestId,
        label: `Rotating multisig group ${groupAlias}`,
        title: 'Rotate multisig group',
        description:
            'Creates a group rotation event with refreshed member key states and sends it to members.',
        kind: 'rotateMultisigGroup',
        resourceKeys: [`multisig:group:${groupAlias}:event`],
        resultRoute: multisigRoute,
        successNotification: {
            title: 'Multisig rotation complete',
            message: `${groupAlias} rotation completed.`,
            severity: 'success',
        },
        failureNotification: {
            title: 'Multisig rotation failed',
            message: `${groupAlias} rotation failed.`,
            severity: 'error',
        },
    };
};

const acceptMultisigRotationOptions = (
    input: MultisigRequestActionInput,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => ({
    requestId,
    label: `Accepting multisig rotation ${input.groupAlias}`,
    title: 'Accept multisig rotation',
    description:
        'Joins the proposed group rotation event and sends this member signature.',
    kind: 'acceptMultisigRotation',
    resourceKeys: multisigProposalResourceKeys(input, 'event'),
    resultRoute: multisigRoute,
    successNotification: {
        title: 'Multisig rotation accepted',
        message: `${input.groupAlias} rotation was accepted.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'Rotation acceptance failed',
        message: `${input.groupAlias} rotation acceptance failed.`,
        severity: 'error',
    },
});

const joinMultisigRotationOptions = (
    input: MultisigRequestActionInput,
    requestId: string
): BackgroundWorkflowRunOptions<MultisigOperationResult> => ({
    requestId,
    label: `Joining multisig group ${input.groupAlias}`,
    title: 'Join multisig rotation',
    description:
        'Signs the embedded rotation as a newly added member and joins the group.',
    kind: 'joinMultisigRotation',
    resourceKeys: multisigProposalResourceKeys(input, 'join'),
    resultRoute: multisigRoute,
    successNotification: {
        title: 'Multisig group joined',
        message: `${input.groupAlias} was joined.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'Multisig join failed',
        message: `${input.groupAlias} could not be joined.`,
        severity: 'error',
    },
});

const multisigProposalResourceKeys = (
    input: MultisigRequestActionInput,
    groupResourceSuffix?: 'agents' | 'event' | 'join'
): string[] => [
    `multisig:proposal:${input.exnSaid}`,
    groupResourceSuffix === undefined
        ? `multisig:group:${input.groupAlias}`
        : `multisig:group:${input.groupAlias}:${groupResourceSuffix}`,
];
