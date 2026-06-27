import { describe, expect, it, vi } from 'vitest';
import { createAppStore } from '../../src/state/store';
import { walletAidSelected } from '../../src/state/walletSelection.slice';
import {
    installWalletSelectionPersistence,
    MemoryWalletSelectionPersistenceStore,
    rehydrateWalletSelection,
} from '../../src/state/walletSelectionPersistence';

describe('wallet selection persistence', () => {
    it('saves, loads, clears, and scopes selected AIDs by controller AID', async () => {
        const storage = new MemoryWalletSelectionPersistenceStore();

        await storage.save('Econtroller1', ' Ealice ');
        await storage.save('Econtroller2', 'Ebob');

        expect(await storage.load('Econtroller1')).toMatchObject({
            controllerAid: 'Econtroller1',
            selectedAid: 'Ealice',
        });
        expect(await storage.load('Econtroller2')).toMatchObject({
            selectedAid: 'Ebob',
        });

        await storage.save('Econtroller1', null);
        expect(await storage.load('Econtroller1')).toMatchObject({
            selectedAid: null,
        });
        expect(await storage.clearAll()).toBe(2);
        expect(await storage.load('Econtroller2')).toBeNull();
    });

    it('persists wallet selection changes through one shared store', async () => {
        const store = createAppStore();
        const storage = new MemoryWalletSelectionPersistenceStore();
        let controllerAid: string | null = 'Econtroller1';
        const uninstall = installWalletSelectionPersistence(
            store,
            () => controllerAid,
            storage
        );

        store.dispatch(walletAidSelected({ aid: 'Ealice' }));
        await vi.waitFor(async () => {
            expect(await storage.load('Econtroller1')).toMatchObject({
                selectedAid: 'Ealice',
            });
        });

        controllerAid = 'Econtroller2';
        store.dispatch(walletAidSelected({ aid: 'Ebob' }));
        await vi.waitFor(async () => {
            expect(await storage.load('Econtroller2')).toMatchObject({
                selectedAid: 'Ebob',
            });
        });

        uninstall();
        expect(await storage.load('Econtroller1')).toMatchObject({
            selectedAid: 'Ealice',
        });
    });

    it('rehydrates persisted selection without overwriting a newer user selection', async () => {
        const store = createAppStore();
        const storage = new MemoryWalletSelectionPersistenceStore();
        await storage.save('Econtroller', 'Eold');

        const rehydrating = rehydrateWalletSelection({
            store,
            controllerAid: 'Econtroller',
            storage,
            canApply: () => true,
        });
        store.dispatch(walletAidSelected({ aid: 'Enew' }));
        await rehydrating;

        expect(store.getState().walletSelection.selectedAid).toBe('Enew');
    });

    it('skips stale async rehydration when the controller changes', async () => {
        const store = createAppStore();
        const storage = new MemoryWalletSelectionPersistenceStore();
        await storage.save('Econtroller', 'Eold');

        await rehydrateWalletSelection({
            store,
            controllerAid: 'Econtroller',
            storage,
            canApply: () => false,
        });

        expect(store.getState().walletSelection.selectedAid).toBeNull();
    });
});
