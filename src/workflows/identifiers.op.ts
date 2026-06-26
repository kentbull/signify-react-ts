import type { Operation as EffectionOperation } from 'effection';
import { AppServicesContext } from '../effects/contexts';
import {
    authorizeAgentEndRoleService,
    createIdentifierService,
    getIdentifierDelegationChainService,
    getIdentifierService,
    listIdentifiersService,
    rotateIdentifierService,
} from '../services/identifiers.service';
import type {
    IdentifierDelegationChainNode,
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../domain/identifiers/identifierTypes';
import {
    identifierCreated,
    identifierLoaded,
    identifierListLoaded,
    identifierRotated,
} from '../state/identifiers.slice';
import { operationPhaseChanged } from '../state/operations.slice';
import type { IdentifierMutationResult } from '../services/identifiers.service';

/*
 * Application operations are the unit-of-work layer. They may read Effection
 * Context for capabilities, but business inputs stay explicit in parameters.
 */

/**
 * Load identifiers through the connected runtime client and update Redux.
 */
export function* listIdentifiersOp(): EffectionOperation<IdentifierSummary[]> {
    const services = yield* AppServicesContext.expect();
    const identifiers = yield* listIdentifiersService({
        client: services.runtime.requireConnectedClient(),
    });

    services.store.dispatch(
        identifierListLoaded({
            identifiers,
            loadedAt: new Date().toISOString(),
        })
    );

    return identifiers;
}

/**
 * Fetch one identifier by alias or prefix and merge the richer state into Redux.
 */
export function* getIdentifierOp(
    aid: string
): EffectionOperation<IdentifierSummary> {
    const services = yield* AppServicesContext.expect();
    const identifier = yield* getIdentifierService({
        client: services.runtime.requireConnectedClient(),
        aid,
    });

    services.store.dispatch(
        identifierLoaded({
            identifier,
            loadedAt: new Date().toISOString(),
        })
    );

    return identifier;
}

/**
 * Resolve a delegation chain from a local identifier to the root delegator.
 */
export function* getIdentifierDelegationChainOp(
    aid: string
): EffectionOperation<IdentifierDelegationChainNode[]> {
    const services = yield* AppServicesContext.expect();
    const state = services.store.getState();
    const localIdentifiers = state.identifiers.prefixes
        .map((prefix) => state.identifiers.byPrefix[prefix])
        .filter(
            (identifier): identifier is IdentifierSummary =>
                identifier !== undefined
        );
    const contacts = state.contacts.ids
        .map((id) => state.contacts.byId[id])
        .filter((contact) => contact !== undefined);

    return yield* getIdentifierDelegationChainService({
        client: services.runtime.requireConnectedClient(),
        aid,
        localIdentifiers,
        contacts,
    });
}

/**
 * Create one identifier from a route draft, wait for KERIA completion, and
 * publish the refreshed identifier list.
 */
export function* createIdentifierOp(
    draft: IdentifierCreateDraft
): EffectionOperation<IdentifierSummary[]> {
    const services = yield* AppServicesContext.expect();
    const result = yield* createIdentifierService({
        client: services.runtime.requireConnectedClient(),
        config: services.config,
        draft,
        logger: services.logger,
    });

    services.store.dispatch(
        identifierCreated({
            name: draft.name.trim(),
            identifiers: result.identifiers,
            updatedAt: new Date().toISOString(),
        })
    );

    return result.identifiers;
}

/**
 * Create one identifier as background work and return delegation details for
 * the operation payload panel when the draft is delegated.
 */
export function* createIdentifierBackgroundOp(
    draft: IdentifierCreateDraft,
    requestId: string
): EffectionOperation<IdentifierMutationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* createIdentifierService({
        client: services.runtime.requireConnectedClient(),
        config: services.config,
        draft,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) => {
            services.store.dispatch(
                operationPhaseChanged({
                    requestId,
                    phase,
                    keriaOperationName,
                })
            );
        },
    });

    services.store.dispatch(
        identifierCreated({
            name: draft.name.trim(),
            identifiers: result.identifiers,
            updatedAt: new Date().toISOString(),
        })
    );

    return result;
}

/**
 * Rotate one identifier, wait for KERIA completion, and publish the refreshed
 * identifier list.
 */
export function* rotateIdentifierOp(
    aid: string
): EffectionOperation<IdentifierSummary[]> {
    const services = yield* AppServicesContext.expect();
    const result = yield* rotateIdentifierService({
        client: services.runtime.requireConnectedClient(),
        config: services.config,
        aid,
        logger: services.logger,
    });

    services.store.dispatch(
        identifierRotated({
            aid,
            identifiers: result.identifiers,
            updatedAt: new Date().toISOString(),
        })
    );

    return result.identifiers;
}

/**
 * Rotate one identifier as background work and return delegation details when
 * the identifier is delegated.
 */
export function* rotateIdentifierBackgroundOp(
    aid: string,
    requestId: string
): EffectionOperation<IdentifierMutationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* rotateIdentifierService({
        client: services.runtime.requireConnectedClient(),
        config: services.config,
        aid,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) => {
            services.store.dispatch(
                operationPhaseChanged({
                    requestId,
                    phase,
                    keriaOperationName,
                })
            );
        },
    });

    services.store.dispatch(
        identifierRotated({
            aid,
            identifiers: result.identifiers,
            updatedAt: new Date().toISOString(),
        })
    );

    return result;
}

/**
 * Authorize the connected KERIA agent as the `agent` endpoint role for one
 * managed identifier and publish refreshed identifier facts.
 */
export function* authorizeAgentEndRoleOp(
    aid: string
): EffectionOperation<IdentifierSummary[]> {
    const services = yield* AppServicesContext.expect();
    const result = yield* authorizeAgentEndRoleService({
        client: services.runtime.requireConnectedClient(),
        aid,
        logger: services.logger,
    });
    const updatedAt = new Date().toISOString();

    services.store.dispatch(
        identifierListLoaded({
            identifiers: result.identifiers,
            loadedAt: updatedAt,
        })
    );
    if (result.refreshed !== null) {
        services.store.dispatch(
            identifierLoaded({
                identifier: result.refreshed,
                loadedAt: updatedAt,
            })
        );
    }

    return result.identifiers;
}

/**
 * Background variant used by the identifier route action.
 */
export function* authorizeAgentEndRoleBackgroundOp(
    aid: string
): EffectionOperation<IdentifierMutationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* authorizeAgentEndRoleService({
        client: services.runtime.requireConnectedClient(),
        aid,
        logger: services.logger,
    });
    const updatedAt = new Date().toISOString();

    services.store.dispatch(
        identifierListLoaded({
            identifiers: result.identifiers,
            loadedAt: updatedAt,
        })
    );
    if (result.refreshed !== null) {
        services.store.dispatch(
            identifierLoaded({
                identifier: result.refreshed,
                loadedAt: updatedAt,
            })
        );
    }

    return result;
}
