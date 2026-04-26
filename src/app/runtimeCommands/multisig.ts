import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { MultisigGroupDetails } from '../../domain/multisig/multisigGroupDetails';
import type {
    MultisigCreateDraft,
    MultisigInteractionDraft,
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
import type {
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
    getGroupDetails: (identifier, options = {}) =>
        context.runWorkflow(() => getMultisigGroupDetailsOp(identifier), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'listIdentifiers',
            track: options.track ?? false,
        }),

    startCreateGroup: (draft, options = {}) => {
        const groupAlias = draft.groupAlias.trim();
        const requestId = options.requestId ?? context.createRequestId();

        return context.startBackgroundWorkflow(
            () => createMultisigGroupOp(draft, requestId),
            {
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
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startAcceptInception: (input, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();

        return context.startBackgroundWorkflow(
            () => acceptMultisigInceptionOp(input, requestId),
            {
                requestId,
                label: `Joining multisig group ${input.groupAlias}`,
                title: 'Join multisig group',
                description:
                    'Recreates the proposed group inception event and sends this member signature to the group.',
                kind: 'acceptMultisigInception',
                resourceKeys: [
                    `multisig:proposal:${input.exnSaid}`,
                    `multisig:group:${input.groupAlias}`,
                ],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startAuthorizeAgents: (input, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();
        const groupAlias = input.groupAlias.trim();

        return context.startBackgroundWorkflow(
            () => authorizeMultisigAgentsOp(input, requestId),
            {
                requestId,
                label: `Authorizing agents for ${groupAlias}`,
                title: 'Authorize multisig agents',
                description:
                    'Signs endpoint role authorizations for member agents and sends them to the group.',
                kind: 'authorizeMultisigAgent',
                resourceKeys: [`multisig:group:${groupAlias}:agents`],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startAcceptEndRole: (input, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();

        return context.startBackgroundWorkflow(
            () => acceptMultisigEndRoleOp(input, requestId),
            {
                requestId,
                label: `Approving multisig role for ${input.groupAlias}`,
                title: 'Approve multisig endpoint role',
                description:
                    'Signs the proposed endpoint role authorization and sends it to group members.',
                kind: 'approveMultisigEndRole',
                resourceKeys: [
                    `multisig:proposal:${input.exnSaid}`,
                    `multisig:group:${input.groupAlias}:agents`,
                ],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startInteractGroup: (draft, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();
        const groupAlias = draft.groupAlias.trim();

        return context.startBackgroundWorkflow(
            () => interactMultisigGroupOp(draft, requestId),
            {
                requestId,
                label: `Interacting with multisig group ${groupAlias}`,
                title: 'Create multisig interaction',
                description:
                    'Creates a group interaction event and sends it to the other members.',
                kind: 'interactMultisigGroup',
                resourceKeys: [`multisig:group:${groupAlias}:event`],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startAcceptInteraction: (input, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();

        return context.startBackgroundWorkflow(
            () => acceptMultisigInteractionOp(input, requestId),
            {
                requestId,
                label: `Accepting multisig interaction ${input.groupAlias}`,
                title: 'Accept multisig interaction',
                description:
                    'Joins the proposed group interaction event and sends this member signature.',
                kind: 'acceptMultisigInteraction',
                resourceKeys: [
                    `multisig:proposal:${input.exnSaid}`,
                    `multisig:group:${input.groupAlias}:event`,
                ],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startRotateGroup: (draft, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();
        const groupAlias = draft.groupAlias.trim();

        return context.startBackgroundWorkflow(
            () => rotateMultisigGroupOp(draft, requestId),
            {
                requestId,
                label: `Rotating multisig group ${groupAlias}`,
                title: 'Rotate multisig group',
                description:
                    'Creates a group rotation event with refreshed member key states and sends it to members.',
                kind: 'rotateMultisigGroup',
                resourceKeys: [`multisig:group:${groupAlias}:event`],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startAcceptRotation: (input, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();

        return context.startBackgroundWorkflow(
            () => acceptMultisigRotationOp(input, requestId),
            {
                requestId,
                label: `Accepting multisig rotation ${input.groupAlias}`,
                title: 'Accept multisig rotation',
                description:
                    'Joins the proposed group rotation event and sends this member signature.',
                kind: 'acceptMultisigRotation',
                resourceKeys: [
                    `multisig:proposal:${input.exnSaid}`,
                    `multisig:group:${input.groupAlias}:event`,
                ],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },

    startJoinRotation: (input, options = {}) => {
        const requestId = options.requestId ?? context.createRequestId();

        return context.startBackgroundWorkflow(
            () => joinMultisigRotationOp(input, requestId),
            {
                requestId,
                label: `Joining multisig group ${input.groupAlias}`,
                title: 'Join multisig rotation',
                description:
                    'Signs the embedded rotation as a newly added member and joins the group.',
                kind: 'joinMultisigRotation',
                resourceKeys: [
                    `multisig:proposal:${input.exnSaid}`,
                    `multisig:group:${input.groupAlias}:join`,
                ],
                resultRoute: { label: 'View multisig', path: '/multisig' },
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
            }
        );
    },
});
