import { describe, expect, it } from 'vitest';
import {
    didWebsDidFailed,
    didWebsDidLoaded,
    didWebsDidLoading,
    didWebsPendingObserved,
    didWebsReadyObserved,
} from '../../src/state/didwebs.slice';
import { selectDidWebsDidByAid } from '../../src/state/selectors';
import { createAppStore } from '../../src/state/store';

describe('did:webs state', () => {
    it('tracks loading, pending, ready, and error DID projections', () => {
        const store = createAppStore();

        store.dispatch(
            didWebsDidLoading({
                aid: 'Eaid',
                updatedAt: '2026-04-29T00:00:00.000Z',
            })
        );
        expect(selectDidWebsDidByAid('Eaid')(store.getState())).toMatchObject({
            loadState: 'loading',
            did: null,
        });

        store.dispatch(
            didWebsDidLoaded({
                aid: 'Eaid',
                did: null,
                updatedAt: '2026-04-29T00:00:01.000Z',
            })
        );
        expect(selectDidWebsDidByAid('Eaid')(store.getState())).toMatchObject({
            loadState: 'pending',
            did: null,
        });

        store.dispatch(
            didWebsDidLoaded({
                aid: 'Eaid',
                did: 'did:webs:example:dws:Eaid',
                updatedAt: '2026-04-29T00:00:02.000Z',
            })
        );
        expect(selectDidWebsDidByAid('Eaid')(store.getState())).toMatchObject({
            loadState: 'ready',
            did: 'did:webs:example:dws:Eaid',
        });

        store.dispatch(
            didWebsDidFailed({
                aid: 'Eaid',
                error: 'network down',
                updatedAt: '2026-04-29T00:00:03.000Z',
            })
        );
        expect(selectDidWebsDidByAid('Eaid')(store.getState())).toMatchObject({
            loadState: 'error',
            error: 'network down',
        });
    });

    it('marks signing requests pending and ready signals copyable', () => {
        const store = createAppStore();

        store.dispatch(
            didWebsPendingObserved({
                aid: 'Eaid',
                updatedAt: '2026-04-29T00:00:00.000Z',
            })
        );
        expect(selectDidWebsDidByAid('Eaid')(store.getState())).toMatchObject({
            loadState: 'pending',
            did: null,
        });

        store.dispatch(
            didWebsReadyObserved({
                aid: 'Eaid',
                did: 'did:webs:example:dws:Eaid',
                updatedAt: '2026-04-29T00:00:01.000Z',
            })
        );
        expect(selectDidWebsDidByAid('Eaid')(store.getState())).toMatchObject({
            loadState: 'ready',
            did: 'did:webs:example:dws:Eaid',
        });
    });
});
