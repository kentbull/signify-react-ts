import {
    approveDelegationRequestOp,
    type ApproveDelegationInput,
    type ApproveDelegationResult,
} from '../../workflows/delegations.op';
import { notificationsRoute } from './helpers';
import { delegationPayloadDetails } from './payloadDetails';
import type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RuntimeCommandContext,
} from './types';

export interface DelegationRuntimeCommands {
    startApprove(
        input: ApproveDelegationInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
}

/**
 * Route-facing delegation commands.
 */
export const createDelegationRuntimeCommands = (
    context: RuntimeCommandContext
): DelegationRuntimeCommands => ({
    startApprove: startApproveDelegation(context),
});

const startApproveDelegation =
    (context: RuntimeCommandContext) =>
    (
        input: ApproveDelegationInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => approveDelegationRequestOp(input),
            approveDelegationOptions(input, options)
        );

const approveDelegationOptions = (
    input: ApproveDelegationInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<ApproveDelegationResult> => ({
    requestId: options.requestId,
    label: `Approving delegation for ${input.request.delegateAid}`,
    title: 'Approve delegation',
    description:
        'Creates the delegator anchor event and refreshes protocol notifications.',
    kind: 'approveDelegation',
    resourceKeys: [
        `delegation:approval:${input.notificationId}`,
        `delegation:delegate:${input.request.delegateAid}`,
    ],
    resultRoute: notificationsRoute,
    successNotification: {
        title: 'Delegation approved',
        message: `Approved delegation for ${input.request.delegateAid}.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'Delegation approval failed',
        message: `Delegation approval for ${input.request.delegateAid} failed.`,
        severity: 'error',
    },
    payloadDetails: delegationPayloadDetails,
});
