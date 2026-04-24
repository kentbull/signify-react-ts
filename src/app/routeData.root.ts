import { redirect } from 'react-router-dom';
import { appConfig } from '../config';
import type { RootActionData, RouteDataRuntime } from './routeData.types';
import { DEFAULT_APP_PATH } from './routeData.types';
import { formString, toRouteError } from './routeData.shared';

/**
 * Root route action for shell-level commands.
 *
 * Currently this handles connect-dialog submissions and passcode generation.
 * Successful connections redirect to the default route; recoverable failures
 * return typed action data for the dialog instead of throwing into the root
 * error boundary.
 */
export const rootAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<Response | RootActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');

    if (intent === 'generatePasscode') {
        try {
            return {
                intent,
                ok: true,
                passcode: await runtime.generatePasscode({
                    signal: request.signal,
                }),
            };
        } catch (error) {
            return {
                intent,
                ok: false,
                message: toRouteError(error).message,
            };
        }
    }

    if (intent === 'connect') {
        const connected = await runtime.connect(
            {
                adminUrl: formString(formData, 'adminUrl'),
                bootUrl: formString(formData, 'bootUrl'),
                passcode: formString(formData, 'passcode'),
                tier: appConfig.defaultTier,
            },
            { signal: request.signal }
        );

        if (connected !== null) {
            return redirect(DEFAULT_APP_PATH);
        }

        return {
            intent,
            ok: false,
            message: 'Unable to connect to KERIA with the supplied passcode.',
        };
    }

    return {
        intent: 'unsupported',
        ok: false,
        message: `Unsupported root action: ${intent || 'missing intent'}`,
    };
};
