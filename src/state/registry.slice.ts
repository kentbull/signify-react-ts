import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';
import type { RegistryRecord } from '../domain/credentials/credentialTypes';

/**
 * Registry slice state keyed by registry id.
 */
export interface RegistryState {
    byId: Record<string, RegistryRecord>;
    ids: string[];
    loadedAt: string | null;
}

const createInitialState = (): RegistryState => ({
    byId: {},
    ids: [],
    loadedAt: null,
});

const initialState: RegistryState = createInitialState();

/**
 * Redux slice for credential registry creation/discovery state.
 */
export const registrySlice = createSlice({
    name: 'registry',
    initialState,
    reducers: {
        registryRecorded(state, { payload }: PayloadAction<RegistryRecord>) {
            for (const id of state.ids) {
                const current = state.byId[id];
                if (
                    current !== undefined &&
                    current.id !== payload.id &&
                    current.issuerAid === payload.issuerAid &&
                    current.registryName === payload.registryName &&
                    current.regk.length === 0
                ) {
                    delete state.byId[id];
                    state.ids = state.ids.filter((candidate) => candidate !== id);
                }
            }
            state.byId[payload.id] = payload;
            if (!state.ids.includes(payload.id)) {
                state.ids.push(payload.id);
            }
        },
        registryInventoryLoaded(
            state,
            {
                payload,
            }: PayloadAction<{ registries: RegistryRecord[]; loadedAt: string }>
        ) {
            const transient = state.ids
                .map((id) => state.byId[id])
                .filter(
                    (registry): registry is RegistryRecord =>
                        registry !== undefined &&
                        (registry.status === 'creating' ||
                            registry.status === 'error')
                );

            state.byId = {};
            state.ids = [];
            for (const registry of payload.registries) {
                state.byId[registry.id] = registry;
                if (!state.ids.includes(registry.id)) {
                    state.ids.push(registry.id);
                }
            }
            for (const registry of transient) {
                if (state.byId[registry.id] === undefined) {
                    state.byId[registry.id] = registry;
                    state.ids.push(registry.id);
                }
            }
            state.loadedAt = payload.loadedAt;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

/** Action creators for updating registry records. */
export const { registryInventoryLoaded, registryRecorded } =
    registrySlice.actions;

/** Reducer mounted at `state.registry`. */
export const registryReducer = registrySlice.reducer;
