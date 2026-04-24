import { isIdentifierCreateDraft } from '../features/identifiers/identifierHelpers';
import type { IdentifierCreateDraft } from '../features/identifiers/identifierTypes';
import type { IdentifierActionData, RouteDataRuntime } from './routeData.types';
import { formString, toRouteError } from './routeData.shared';

interface IdentifierActionContext {
    runtime: RouteDataRuntime;
    formData: FormData;
    intent: string;
}

/**
 * Parse the serialized typed create draft submitted by `IdentifiersView`.
 */
const parseIdentifierCreateDraft = (
    value: string
): IdentifierCreateDraft | null => {
    if (value.trim().length === 0) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return isIdentifierCreateDraft(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const requestIdOption = (requestId: string): { requestId?: string } =>
    requestId.length > 0 ? { requestId } : {};

/**
 * Starts identifier inception from the typed draft submitted by the view. The
 * route action owns serialized form parsing; the runtime owns the cancellable
 * create workflow and KERIA operation lifecycle.
 */
const createIdentifierAction = ({
    runtime,
    formData,
}: IdentifierActionContext): IdentifierActionData => {
    const intent = 'create';
    const requestId = formString(formData, 'requestId');
    const draft = parseIdentifierCreateDraft(formString(formData, 'draft'));
    if (draft === null) {
        return {
            intent,
            ok: false,
            message: 'Invalid identifier create draft.',
            requestId,
        };
    }

    const started = runtime.startCreateIdentifier(
        draft,
        requestIdOption(requestId)
    );
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
        message: `Creating identifier ${draft.name}`,
        requestId: started.requestId,
        operationRoute: started.operationRoute,
    };
};

/**
 * Starts rotation for one existing identifier AID. This handler is intentionally
 * narrow so rotate validation, conflict reporting, and operation routing stay
 * auditable apart from create semantics.
 */
const rotateIdentifierAction = ({
    runtime,
    formData,
}: IdentifierActionContext): IdentifierActionData => {
    const intent = 'rotate';
    const aid = formString(formData, 'aid');
    const requestId = formString(formData, 'requestId');
    const started = runtime.startRotateIdentifier(
        aid,
        requestIdOption(requestId)
    );
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
        message: `Rotating identifier ${aid}`,
        requestId: started.requestId,
        operationRoute: started.operationRoute,
    };
};

/**
 * Dispatches identifier route intents to named handlers. The switch is kept
 * explicit because identifier commands are high-impact protocol mutations and
 * should not be hidden behind dynamic lookup.
 */
const runIdentifierIntentAction = (
    context: IdentifierActionContext
): IdentifierActionData => {
    switch (context.intent) {
        case 'create':
            return createIdentifierAction(context);
        case 'rotate':
            return rotateIdentifierAction(context);
        default:
            return {
                intent: 'unsupported',
                ok: false,
                message: `Unsupported identifier action: ${
                    context.intent || 'missing intent'
                }`,
            };
    }
};

/**
 * Route action for identifier mutations.
 *
 * Create and rotate are intent-based because both mutate the same route data
 * and should trigger identifier-loader revalidation after completion.
 */
export const identifiersAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<IdentifierActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const context: IdentifierActionContext = {
        runtime,
        formData,
        intent,
    };

    if (runtime.getClient() === null) {
        return {
            intent: intent === 'rotate' ? 'rotate' : 'create',
            ok: false,
            message: 'Connect to KERIA before changing identifiers.',
        };
    }

    try {
        return runIdentifierIntentAction(context);
    } catch (error) {
        return {
            intent: intent === 'rotate' ? 'rotate' : 'create',
            ok: false,
            message: toRouteError(error).message,
            requestId: formString(formData, 'requestId'),
        };
    }
};
