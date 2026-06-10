import type { Operation as EffectionOperation } from 'effection';
import { callPromise, toErrorText } from '../effects/promise';
import { AppServicesContext } from '../effects/contexts';
import {
    didWebsDidFailed,
    didWebsDidLoaded,
    didWebsDidLoading,
    type DidWebsDidPayload,
} from '../state/didwebs.slice';

/**
 * Refresh one managed identifier did:webs DID into Redux.
 */
export function* refreshIdentifierDidWebsOp({
    name,
    aid,
}: {
    name: string;
    aid: string;
}): EffectionOperation<DidWebsDidPayload | null> {
    const services = yield* AppServicesContext.expect();
    const updatedAt = new Date().toISOString();
    services.store.dispatch(
        didWebsDidLoading({
            aid,
            updatedAt,
        })
    );

    try {
        const dws = yield* callPromise(() =>
            services.runtime.requireConnectedClient().identifiers().dws(name)
        );
        const payload: DidWebsDidPayload = {
            aid,
            did: dws.dws,
            didJsonUrl: dws.didJsonUrl,
            keriCesrUrl: dws.keriCesrUrl,
            updatedAt: new Date().toISOString(),
        };
        services.store.dispatch(didWebsDidLoaded(payload));
        return payload;
    } catch (error) {
        services.store.dispatch(
            didWebsDidFailed({
                aid,
                error: toErrorText(error),
                updatedAt: new Date().toISOString(),
            })
        );
        return null;
    }
}
