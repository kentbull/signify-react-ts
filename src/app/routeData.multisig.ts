import type {
    MultisigCreateDraft,
    MultisigInteractionDraft,
    MultisigRequestActionInput,
    MultisigRotationDraft,
} from '../features/multisig/multisigTypes';
import {
    isMultisigThresholdSpec,
    thresholdSpecForMembers,
    type MultisigThresholdSpec,
} from '../features/multisig/multisigThresholds';
import type { BackgroundWorkflowStartResult } from './runtime';
import type { MultisigActionData, RouteDataRuntime } from './routeData.types';
import {
    formString,
    isRecord,
    isStringArray,
    toRouteError,
} from './routeData.shared';

type MultisigIntent = Exclude<MultisigActionData['intent'], 'unsupported'>;

interface MultisigActionContext {
    runtime: RouteDataRuntime;
    formData: FormData;
    intent: string;
    requestId: string;
}

const isThresholdSpec = (value: unknown): value is MultisigThresholdSpec =>
    isMultisigThresholdSpec(value);

const parseJsonRecord = (value: string): Record<string, unknown> | null => {
    if (value.trim().length === 0) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const parseMultisigCreateDraft = (
    value: string
): MultisigCreateDraft | null => {
    const parsed = parseJsonRecord(value);
    if (parsed === null) {
        return null;
    }

    const signingMemberAids = parsed.signingMemberAids;
    const rotationMemberAids = parsed.rotationMemberAids;
    if (
        typeof parsed.groupAlias !== 'string' ||
        parsed.groupAlias.trim().length === 0 ||
        typeof parsed.localMemberName !== 'string' ||
        parsed.localMemberName.trim().length === 0 ||
        typeof parsed.localMemberAid !== 'string' ||
        parsed.localMemberAid.trim().length === 0 ||
        !Array.isArray(parsed.members) ||
        !isStringArray(signingMemberAids) ||
        !isStringArray(rotationMemberAids)
    ) {
        return null;
    }

    return {
        groupAlias: parsed.groupAlias,
        localMemberName: parsed.localMemberName,
        localMemberAid: parsed.localMemberAid,
        members: parsed.members.flatMap((member) =>
            isRecord(member) &&
            typeof member.aid === 'string' &&
            typeof member.alias === 'string'
                ? [
                      {
                          aid: member.aid,
                          alias: member.alias,
                          source:
                              member.source === 'local' ||
                              member.source === 'contact' ||
                              member.source === 'manual'
                                  ? member.source
                                  : 'manual',
                      },
                  ]
                : []
        ),
        signingMemberAids,
        rotationMemberAids,
        signingThreshold: isThresholdSpec(parsed.signingThreshold)
            ? parsed.signingThreshold
            : thresholdSpecForMembers(signingMemberAids),
        rotationThreshold: isThresholdSpec(parsed.rotationThreshold)
            ? parsed.rotationThreshold
            : thresholdSpecForMembers(rotationMemberAids),
        witnessMode: parsed.witnessMode === 'demo' ? 'demo' : 'none',
    };
};

const parseMultisigInteractionDraft = (
    formData: FormData
): MultisigInteractionDraft | null => {
    const groupAlias = formString(formData, 'groupAlias').trim();
    if (groupAlias.length === 0) {
        return null;
    }

    const rawData = formString(formData, 'data').trim();
    let data: unknown = {};
    if (rawData.length > 0) {
        try {
            data = JSON.parse(rawData);
        } catch {
            data = rawData;
        }
    }

    return {
        groupAlias,
        localMemberName: formString(formData, 'localMemberName').trim() || null,
        data,
    };
};

const parseMultisigRotationDraft = (
    value: string
): MultisigRotationDraft | null => {
    const parsed = parseJsonRecord(value);
    if (parsed === null) {
        return null;
    }

    if (
        typeof parsed.groupAlias !== 'string' ||
        parsed.groupAlias.trim().length === 0 ||
        !isStringArray(parsed.signingMemberAids) ||
        !isStringArray(parsed.rotationMemberAids)
    ) {
        return null;
    }

    return {
        groupAlias: parsed.groupAlias,
        localMemberName:
            typeof parsed.localMemberName === 'string'
                ? parsed.localMemberName
                : null,
        signingMemberAids: parsed.signingMemberAids,
        rotationMemberAids: parsed.rotationMemberAids,
        nextThreshold: isThresholdSpec(parsed.nextThreshold)
            ? parsed.nextThreshold
            : thresholdSpecForMembers(parsed.rotationMemberAids),
    };
};

const parseMultisigRequestInput = (
    formData: FormData
): MultisigRequestActionInput | null => {
    const exnSaid = formString(formData, 'exnSaid').trim();
    const groupAlias = formString(formData, 'groupAlias').trim();
    const localMemberName = formString(formData, 'localMemberName').trim();
    if (
        exnSaid.length === 0 ||
        groupAlias.length === 0 ||
        localMemberName.length === 0
    ) {
        return null;
    }

    return {
        notificationId: formString(formData, 'notificationId').trim() || null,
        exnSaid,
        groupAlias,
        localMemberName,
    };
};

const multisigIntentFromString = (value: string): MultisigIntent =>
    value === 'acceptInception' ||
    value === 'joinInception' ||
    value === 'authorizeAgents' ||
    value === 'acceptEndRole' ||
    value === 'interact' ||
    value === 'acceptInteraction' ||
    value === 'rotate' ||
    value === 'acceptRotation' ||
    value === 'joinRotation'
        ? value
        : 'create';

const requestIdOption = (requestId: string): { requestId?: string } =>
    requestId.length > 0 ? { requestId } : {};

const multisigActionStarted = (
    intent: MultisigIntent,
    started: BackgroundWorkflowStartResult,
    message: string
): MultisigActionData => {
    if (started.status === 'conflict') {
        return {
            intent,
            ok: false,
            message: started.message,
            requestId: started.requestId,
            operationRoute: started.operationRoute,
        };
    }

    return {
        intent,
        ok: true,
        message,
        requestId: started.requestId,
        operationRoute: started.operationRoute,
    };
};

/**
 * Starts multisig inception from a typed draft submitted by the view. Draft
 * parsing is kept at the route boundary so the workflow receives validated
 * members, thresholds, and witness mode instead of serialized UI state.
 */
const createMultisigAction = ({
    runtime,
    formData,
    requestId,
}: MultisigActionContext): MultisigActionData => {
    const intent = 'create';
    const draft = parseMultisigCreateDraft(formString(formData, 'draft'));
    if (draft === null) {
        return {
            intent,
            ok: false,
            message: 'Invalid multisig group draft.',
            requestId,
        };
    }

    return multisigActionStarted(
        intent,
        runtime.startCreateMultisigGroup(draft, requestIdOption(requestId)),
        `Creating multisig group ${draft.groupAlias}`
    );
};

/**
 * Starts agent end-role authorization for a created multisig group. This is a
 * separate intent because role authorization is a protocol step after group
 * inception, not a cosmetic follow-up to creation.
 */
const authorizeMultisigAgentsAction = ({
    runtime,
    formData,
    requestId,
}: MultisigActionContext): MultisigActionData => {
    const intent = 'authorizeAgents';
    const groupAlias = formString(formData, 'groupAlias').trim();
    if (groupAlias.length === 0) {
        return {
            intent,
            ok: false,
            message: 'Group alias is required.',
            requestId,
        };
    }

    return multisigActionStarted(
        intent,
        runtime.startAuthorizeMultisigAgents(
            {
                groupAlias,
                localMemberName:
                    formString(formData, 'localMemberName').trim() || null,
            },
            requestIdOption(requestId)
        ),
        `Authorizing agents for ${groupAlias}`
    );
};

/**
 * Starts an interaction event for an existing multisig group. The handler keeps
 * optional interaction data parsing close to the route form while leaving event
 * construction and multisig polling inside the workflow boundary.
 */
const interactMultisigAction = ({
    runtime,
    formData,
    requestId,
}: MultisigActionContext): MultisigActionData => {
    const intent = 'interact';
    const draft = parseMultisigInteractionDraft(formData);
    if (draft === null) {
        return {
            intent,
            ok: false,
            message: 'Group alias is required.',
            requestId,
        };
    }

    return multisigActionStarted(
        intent,
        runtime.startInteractMultisigGroup(draft, requestIdOption(requestId)),
        `Interacting with ${draft.groupAlias}`
    );
};

/**
 * Starts a multisig rotation from a typed rotation draft. Rotation has its own
 * handler because next-member and threshold semantics differ from inception
 * even though both arrive as serialized drafts.
 */
const rotateMultisigAction = ({
    runtime,
    formData,
    requestId,
}: MultisigActionContext): MultisigActionData => {
    const intent = 'rotate';
    const draft = parseMultisigRotationDraft(formString(formData, 'draft'));
    if (draft === null) {
        return {
            intent,
            ok: false,
            message: 'Invalid multisig rotation draft.',
            requestId,
        };
    }

    return multisigActionStarted(
        intent,
        runtime.startRotateMultisigGroup(draft, requestIdOption(requestId)),
        `Rotating multisig group ${draft.groupAlias}`
    );
};

/**
 * Handles inbound multisig EXN requests that share the same route form shape.
 * The branch remains explicit because accepting, joining, interaction, and
 * rotation responses call distinct runtime workflows with different effects.
 */
const respondToMultisigRequestAction = ({
    runtime,
    formData,
    intent,
    requestId,
}: MultisigActionContext): MultisigActionData => {
    if (
        intent !== 'acceptInception' &&
        intent !== 'joinInception' &&
        intent !== 'acceptEndRole' &&
        intent !== 'acceptInteraction' &&
        intent !== 'acceptRotation' &&
        intent !== 'joinRotation'
    ) {
        return {
            intent: 'unsupported',
            ok: false,
            message: `Unsupported multisig action: ${intent || 'missing intent'}`,
            requestId,
        };
    }

    const groupAlias = formString(formData, 'groupAlias').trim();
    if (
        (intent === 'acceptInception' || intent === 'joinInception') &&
        groupAlias.length === 0
    ) {
        return {
            intent,
            ok: false,
            message: 'Enter a label for this new group identifier.',
            requestId,
        };
    }

    const input = parseMultisigRequestInput(formData);
    if (input === null) {
        return {
            intent,
            ok: false,
            message:
                'Notification SAID, group alias, and local member are required.',
            requestId,
        };
    }

    const options = requestIdOption(requestId);
    const started =
        intent === 'acceptInception' || intent === 'joinInception'
            ? runtime.startAcceptMultisigInception(input, options)
            : intent === 'acceptEndRole'
              ? runtime.startAcceptMultisigEndRole(input, options)
              : intent === 'acceptInteraction'
                ? runtime.startAcceptMultisigInteraction(input, options)
                : intent === 'acceptRotation'
                  ? runtime.startAcceptMultisigRotation(input, options)
                  : runtime.startJoinMultisigRotation(input, options);

    return multisigActionStarted(
        intent,
        started,
        intent === 'joinInception'
            ? `Joining multisig group ${input.groupAlias}`
            : `Handling multisig request for ${input.groupAlias}`
    );
};

/**
 * Dispatches multisig route intents to named command handlers. This switch is
 * the supported multisig action surface; avoid hiding new protocol steps behind
 * generic request handling unless their workflow semantics are truly identical.
 */
const runMultisigIntentAction = (
    context: MultisigActionContext
): MultisigActionData => {
    switch (context.intent) {
        case 'create':
            return createMultisigAction(context);
        case 'authorizeAgents':
            return authorizeMultisigAgentsAction(context);
        case 'interact':
            return interactMultisigAction(context);
        case 'rotate':
            return rotateMultisigAction(context);
        case 'acceptInception':
        case 'joinInception':
        case 'acceptEndRole':
        case 'acceptInteraction':
        case 'acceptRotation':
        case 'joinRotation':
            return respondToMultisigRequestAction(context);
        default:
            return {
                intent: 'unsupported',
                ok: false,
                message: `Unsupported multisig action: ${
                    context.intent || 'missing intent'
                }`,
                requestId: context.requestId,
            };
    }
};

/**
 * Route action for multisig group workflows.
 */
export const multisigAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<MultisigActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const requestId = formString(formData, 'requestId');

    if (runtime.getClient() === null) {
        return {
            intent: multisigIntentFromString(intent),
            ok: false,
            message: 'Connect to KERIA before changing multisig groups.',
            requestId,
        };
    }

    try {
        return runMultisigIntentAction({
            runtime,
            formData,
            intent,
            requestId,
        });
    } catch (error) {
        return {
            intent: multisigIntentFromString(intent),
            ok: false,
            message: toRouteError(error).message,
            requestId,
        };
    }
};
