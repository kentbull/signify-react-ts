import {
    approveDelegationRequestOp,
    type ApproveDelegationInput,
} from '../../workflows/delegations.op';
import { delegationPayloadDetails } from './payloadDetails';
import type {
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
    startApprove: (input, options = {}) =>
        context.startBackgroundWorkflow(() => approveDelegationRequestOp(input), {
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
            resultRoute: {
                label: 'View notifications',
                path: '/notifications',
            },
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
        }),
});
