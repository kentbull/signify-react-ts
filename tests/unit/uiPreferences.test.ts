import { describe, expect, it } from 'vitest';
import {
    hoverSoundMutedSet,
    hoverSoundMutedToggled,
    themeModeSet,
    themeModeToggled,
} from '../../src/state/uiPreferences.slice';
import {
    installUiPreferencesPersistence,
    loadPersistedUiPreferences,
    savePersistedUiPreferences,
    UI_PREFERENCES_STORAGE_KEY,
    type PersistedUiPreferences,
} from '../../src/state/uiPreferencesPersistence';
import { createAppStore } from '../../src/state/store';
import {
    selectHoverSoundMuted,
    selectThemeMode,
} from '../../src/state/selectors';
import type { AppStateStorage } from '../../src/state/persistence';

/**
 * Minimal storage fake for global UI-preference persistence.
 */
class MemoryStorage implements AppStateStorage {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

/**
 * Decode the persisted preference bucket for assertions.
 */
const persisted = (storage: MemoryStorage): PersistedUiPreferences | null => {
    const text = storage.getItem(UI_PREFERENCES_STORAGE_KEY);
    return text === null ? null : (JSON.parse(text) as PersistedUiPreferences);
};

describe('UI preferences state', () => {
    it('defaults hover sound to enabled and theme to dark', () => {
        const store = createAppStore();

        expect(selectHoverSoundMuted(store.getState())).toBe(false);
        expect(selectThemeMode(store.getState())).toBe('dark');
    });

    it('sets and toggles mute and theme state', () => {
        const store = createAppStore();

        store.dispatch(hoverSoundMutedToggled());
        expect(selectHoverSoundMuted(store.getState())).toBe(true);

        store.dispatch(hoverSoundMutedSet(false));
        expect(selectHoverSoundMuted(store.getState())).toBe(false);

        store.dispatch(themeModeToggled());
        expect(selectThemeMode(store.getState())).toBe('light');

        store.dispatch(themeModeSet('dark'));
        expect(selectThemeMode(store.getState())).toBe('dark');
    });

    it('loads and saves global UI preferences', () => {
        const storage = new MemoryStorage();

        savePersistedUiPreferences(
            { hoverSoundMuted: true, themeMode: 'light' },
            storage
        );

        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: true,
            themeMode: 'light',
        });
    });

    it('migrates v1 persisted preferences with dark theme default', () => {
        const storage = new MemoryStorage();

        storage.setItem(
            UI_PREFERENCES_STORAGE_KEY,
            JSON.stringify({ version: 1, hoverSoundMuted: true })
        );

        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: true,
            themeMode: 'dark',
        });
    });

    it('falls back to defaults for malformed persisted preferences', () => {
        const storage = new MemoryStorage();

        storage.setItem(UI_PREFERENCES_STORAGE_KEY, '{not-json');
        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: false,
            themeMode: 'dark',
        });

        storage.setItem(
            UI_PREFERENCES_STORAGE_KEY,
            JSON.stringify({
                version: 2,
                hoverSoundMuted: 'yes',
                themeMode: 'light',
            })
        );
        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: false,
            themeMode: 'dark',
        });

        storage.setItem(
            UI_PREFERENCES_STORAGE_KEY,
            JSON.stringify({
                version: 2,
                hoverSoundMuted: false,
                themeMode: 'auto',
            })
        );
        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: false,
            themeMode: 'dark',
        });
    });

    it('persists only when the UI preference changes', () => {
        const store = createAppStore();
        const storage = new MemoryStorage();
        const uninstall = installUiPreferencesPersistence(store, storage);

        expect(persisted(storage)).toBeNull();

        store.dispatch(hoverSoundMutedSet(true));
        expect(persisted(storage)).toMatchObject({
            hoverSoundMuted: true,
            themeMode: 'dark',
        });

        store.dispatch(themeModeSet('light'));
        expect(persisted(storage)).toMatchObject({
            hoverSoundMuted: true,
            themeMode: 'light',
        });

        uninstall();
    });
});
