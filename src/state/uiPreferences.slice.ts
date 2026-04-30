import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Explicit visual theme mode selected by the user.
 */
export type ThemeMode = 'dark' | 'light';

/**
 * Global, non-secret interface preferences.
 */
export interface UiPreferencesState {
    hoverSoundMuted: boolean;
    themeMode: ThemeMode;
}

/**
 * Default browser UI preferences before localStorage rehydration.
 */
export const defaultUiPreferencesState: UiPreferencesState = {
    hoverSoundMuted: false,
    themeMode: 'dark',
};

/**
 * Reducers for global UI preferences that are independent of Signify sessions.
 */
export const uiPreferencesSlice = createSlice({
    name: 'uiPreferences',
    initialState: defaultUiPreferencesState,
    reducers: {
        hoverSoundMutedSet(state, { payload }: PayloadAction<boolean>) {
            state.hoverSoundMuted = payload;
        },
        hoverSoundMutedToggled(state) {
            state.hoverSoundMuted = !state.hoverSoundMuted;
        },
        themeModeSet(state, { payload }: PayloadAction<ThemeMode>) {
            state.themeMode = payload;
        },
        themeModeToggled(state) {
            state.themeMode = state.themeMode === 'dark' ? 'light' : 'dark';
        },
    },
});

export const {
    hoverSoundMutedSet,
    hoverSoundMutedToggled,
    themeModeSet,
    themeModeToggled,
} = uiPreferencesSlice.actions;

/**
 * Reducer installed into the root Redux store for interface preferences.
 */
export const uiPreferencesReducer = uiPreferencesSlice.reducer;
