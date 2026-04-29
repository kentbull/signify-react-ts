import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Loading lifecycle for one did:webs DID projection. */
export type DidWebsLoadState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'unavailable'
    | 'error';

/** Serializable did:webs DID facts keyed by AID. */
export interface DidWebsStatusRecord {
    aid: string;
    loadState: DidWebsLoadState;
    did: string | null;
    error: string | null;
    updatedAt: string | null;
}

/** did:webs DID cache normalized by AID. */
export interface DidWebsState {
    byAid: Record<string, DidWebsStatusRecord>;
}

export interface DidWebsDidPayload {
    aid: string;
    did: string | null;
    updatedAt: string;
}

const createInitialState = (): DidWebsState => ({
    byAid: {},
});

const initialState = createInitialState();

const emptyRecord = (aid: string): DidWebsStatusRecord => ({
    aid,
    loadState: 'idle',
    did: null,
    error: null,
    updatedAt: null,
});

const recordFor = (
    state: DidWebsState,
    aid: string
): DidWebsStatusRecord => {
    state.byAid[aid] ??= emptyRecord(aid);
    return state.byAid[aid];
};

const applyDidPayload = (
    record: DidWebsStatusRecord,
    payload: DidWebsDidPayload
): void => {
    record.loadState = payload.did === null ? 'unavailable' : 'ready';
    record.did = payload.did;
    record.error = null;
    record.updatedAt = payload.updatedAt;
};

/** Redux slice for did:webs DID projections. */
export const didWebsSlice = createSlice({
    name: 'didwebs',
    initialState,
    reducers: {
        didWebsDidLoading(
            state,
            {
                payload,
            }: PayloadAction<{
                aid: string;
                updatedAt: string;
            }>
        ) {
            const record = recordFor(state, payload.aid);
            record.loadState = 'loading';
            record.error = null;
            record.updatedAt = payload.updatedAt;
        },
        didWebsDidLoaded(
            state,
            { payload }: PayloadAction<DidWebsDidPayload>
        ) {
            applyDidPayload(recordFor(state, payload.aid), payload);
        },
        didWebsDidFailed(
            state,
            {
                payload,
            }: PayloadAction<{
                aid: string;
                error: string;
                updatedAt: string;
            }>
        ) {
            const record = recordFor(state, payload.aid);
            record.loadState = 'error';
            record.error = payload.error;
            record.updatedAt = payload.updatedAt;
        },
        didWebsPendingObserved(
            state,
            {
                payload,
            }: PayloadAction<{
                aid: string;
                updatedAt: string;
            }>
        ) {
            const record = recordFor(state, payload.aid);
            if (record.did === null) {
                record.loadState = 'unavailable';
            }
            record.error = null;
            record.updatedAt = payload.updatedAt;
        },
        didWebsReadyObserved(
            state,
            { payload }: PayloadAction<DidWebsDidPayload>
        ) {
            applyDidPayload(recordFor(state, payload.aid), payload);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

/** Action creators for did:webs DID updates. */
export const {
    didWebsDidFailed,
    didWebsDidLoaded,
    didWebsDidLoading,
    didWebsPendingObserved,
    didWebsReadyObserved,
} = didWebsSlice.actions;

/** Reducer mounted at `state.didwebs`. */
export const didWebsReducer = didWebsSlice.reducer;
