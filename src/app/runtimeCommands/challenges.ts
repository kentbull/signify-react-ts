import {
    challengeResultRoute,
    generateContactChallengeOp,
    respondToContactChallengeOp,
    sendChallengeRequestOp,
    verifyContactChallengeOp,
    type GeneratedContactChallengeResult,
    type GenerateContactChallengeInput,
    type RespondToContactChallengeInput,
    type SendChallengeRequestInput,
    type VerifyContactChallengeInput,
} from '../../workflows/challenges.op';
import type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RequestSignalOptions,
    RuntimeCommandContext,
} from './types';

export interface ChallengeRuntimeCommands {
    generate(
        input: GenerateContactChallengeInput,
        options?: RequestSignalOptions
    ): Promise<GeneratedContactChallengeResult>;
    startRespond(
        input: RespondToContactChallengeInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startSendRequest(
        input: SendChallengeRequestInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startVerify(
        input: VerifyContactChallengeInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
}

/**
 * Route-facing challenge-response commands.
 */
export const createChallengeRuntimeCommands = (
    context: RuntimeCommandContext
): ChallengeRuntimeCommands => ({
    generate: generateChallenge(context),
    startRespond: startRespondToChallenge(context),
    startSendRequest: startSendChallengeRequest(context),
    startVerify: startVerifyContactChallenge(context),
});

const generateChallenge =
    (context: RuntimeCommandContext) =>
    (
        input: GenerateContactChallengeInput,
        options: RequestSignalOptions = {}
    ): Promise<GeneratedContactChallengeResult> =>
        context.runWorkflow(() => generateContactChallengeOp(input), {
            ...options,
            kind: 'generateChallenge',
            track: false,
        });

const startRespondToChallenge =
    (context: RuntimeCommandContext) =>
    (
        input: RespondToContactChallengeInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => respondToContactChallengeOp(input),
            respondToChallengeOptions(input, options)
        );

const startSendChallengeRequest =
    (context: RuntimeCommandContext) =>
    (
        input: SendChallengeRequestInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => sendChallengeRequestOp(input),
            sendChallengeRequestOptions(input, options)
        );

const startVerifyContactChallenge =
    (context: RuntimeCommandContext) =>
    (
        input: VerifyContactChallengeInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => verifyContactChallengeOp(input),
            verifyContactChallengeOptions(input, options)
        );

const respondToChallengeOptions = (
    input: RespondToContactChallengeInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<unknown> => ({
    requestId: options.requestId,
    label: `Sending challenge response to ${input.counterpartyAid}`,
    title: 'Send challenge response',
    description:
        'Signs the challenge words with the selected identifier and sends the response to the contact.',
    kind: 'respondChallenge',
    resourceKeys: [
        `challenge:respond:${input.counterpartyAid}:${input.localIdentifier}:${input.challengeId ?? 'current'}`,
    ],
    resultRoute: challengeResultRoute(input.counterpartyAid),
    successNotification: {
        title: 'Challenge response sent',
        message: 'The signed challenge response was sent.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Challenge response failed',
        message: 'The challenge response could not be sent.',
        severity: 'error',
    },
});

const sendChallengeRequestOptions = (
    input: SendChallengeRequestInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<unknown> => ({
    requestId: options.requestId,
    label: `Sending challenge request to ${input.counterpartyAid}`,
    title: 'Send challenge request',
    description:
        'Sends a challenge request notification without embedding the challenge words.',
    kind: 'sendChallengeRequest',
    resourceKeys: [
        `challenge:request:${input.counterpartyAid}:${input.localIdentifier}:${input.challengeId}`,
    ],
    resultRoute: challengeResultRoute(input.counterpartyAid),
    successNotification: {
        title: 'Challenge request sent',
        message:
            'The contact was notified that a challenge response is requested.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Challenge request failed',
        message:
            'The challenge words remain available, but the notification could not be sent.',
        severity: 'error',
    },
});

const verifyContactChallengeOptions = (
    input: VerifyContactChallengeInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<unknown> => ({
    requestId: options.requestId,
    label: `Waiting for challenge response from ${input.counterpartyAid}`,
    title: 'Verify challenge response',
    description:
        'Waits for a matching challenge response, accepts the response SAID, and refreshes contact inventory.',
    kind: 'verifyChallenge',
    resourceKeys: [
        `challenge:verify:${input.counterpartyAid}:${input.challengeId}`,
    ],
    resultRoute: challengeResultRoute(input.counterpartyAid),
    successNotification: {
        title: 'Challenge verified',
        message: 'The contact challenge response was accepted.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Challenge verification failed',
        message: 'The challenge response was not verified.',
        severity: 'error',
    },
});
