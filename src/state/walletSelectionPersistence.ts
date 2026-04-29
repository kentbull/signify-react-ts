import { walletAidSelected } from './walletSelection.slice';
import type { AppStore } from './store';

const WALLET_SELECTION_VERSION = 1;
const WALLET_SELECTION_DB_NAME = 'signify-react-ts-wallet-selection';
const WALLET_SELECTION_STORE_NAME = 'walletSelection';

export interface PersistedWalletSelection {
    version: typeof WALLET_SELECTION_VERSION;
    controllerAid: string;
    selectedAid: string | null;
    updatedAt: string;
}

export interface WalletSelectionPersistenceStore {
    load(controllerAid: string): Promise<PersistedWalletSelection | null>;
    save(controllerAid: string, selectedAid: string | null): Promise<void>;
    clearAll(): Promise<number>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const normalizeAid = (aid: string | null): string | null => {
    const normalized = aid?.trim() ?? '';
    return normalized.length === 0 ? null : normalized;
};

const isPersistedWalletSelection = (
    value: unknown
): value is PersistedWalletSelection =>
    isRecord(value) &&
    value.version === WALLET_SELECTION_VERSION &&
    typeof value.controllerAid === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.selectedAid === null || typeof value.selectedAid === 'string');

export class MemoryWalletSelectionPersistenceStore
    implements WalletSelectionPersistenceStore
{
    private readonly records = new Map<string, PersistedWalletSelection>();

    async load(controllerAid: string): Promise<PersistedWalletSelection | null> {
        return this.records.get(controllerAid) ?? null;
    }

    async save(controllerAid: string, selectedAid: string | null): Promise<void> {
        this.records.set(controllerAid, {
            version: WALLET_SELECTION_VERSION,
            controllerAid,
            selectedAid: normalizeAid(selectedAid),
            updatedAt: new Date().toISOString(),
        });
    }

    async clearAll(): Promise<number> {
        const count = this.records.size;
        this.records.clear();
        return count;
    }
}

const requestPromise = <T>(request: IDBRequest<T>): Promise<T> =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(request.error ?? new Error('IndexedDB request failed.'));
    });

const transactionComplete = (transaction: IDBTransaction): Promise<void> =>
    new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () =>
            reject(
                transaction.error ?? new Error('IndexedDB transaction failed.')
            );
        transaction.onabort = () =>
            reject(
                transaction.error ?? new Error('IndexedDB transaction aborted.')
            );
    });

export class IndexedDbWalletSelectionPersistenceStore
    implements WalletSelectionPersistenceStore
{
    constructor(private readonly factory: IDBFactory) {}

    async load(controllerAid: string): Promise<PersistedWalletSelection | null> {
        const db = await this.openDb();
        try {
            const transaction = db.transaction(
                WALLET_SELECTION_STORE_NAME,
                'readonly'
            );
            const done = transactionComplete(transaction);
            const store = transaction.objectStore(WALLET_SELECTION_STORE_NAME);
            const record = await requestPromise(store.get(controllerAid));
            await done;
            return isPersistedWalletSelection(record) ? record : null;
        } finally {
            db.close();
        }
    }

    async save(controllerAid: string, selectedAid: string | null): Promise<void> {
        const db = await this.openDb();
        try {
            const transaction = db.transaction(
                WALLET_SELECTION_STORE_NAME,
                'readwrite'
            );
            const done = transactionComplete(transaction);
            const store = transaction.objectStore(WALLET_SELECTION_STORE_NAME);
            store.put({
                version: WALLET_SELECTION_VERSION,
                controllerAid,
                selectedAid: normalizeAid(selectedAid),
                updatedAt: new Date().toISOString(),
            } satisfies PersistedWalletSelection);
            await done;
        } finally {
            db.close();
        }
    }

    async clearAll(): Promise<number> {
        const db = await this.openDb();
        try {
            const transaction = db.transaction(
                WALLET_SELECTION_STORE_NAME,
                'readwrite'
            );
            const done = transactionComplete(transaction);
            const store = transaction.objectStore(WALLET_SELECTION_STORE_NAME);
            const countRequest = store.count();
            store.clear();
            const count = await requestPromise(countRequest);
            await done;
            return count;
        } finally {
            db.close();
        }
    }

    private openDb(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = this.factory.open(WALLET_SELECTION_DB_NAME, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(WALLET_SELECTION_STORE_NAME)) {
                    db.createObjectStore(WALLET_SELECTION_STORE_NAME, {
                        keyPath: 'controllerAid',
                    });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () =>
                reject(request.error ?? new Error('Unable to open IndexedDB.'));
        });
    }
}

export const createBrowserWalletSelectionPersistenceStore =
    (): WalletSelectionPersistenceStore => {
        try {
            const factory = globalThis.indexedDB;
            if (factory !== undefined) {
                return new IndexedDbWalletSelectionPersistenceStore(factory);
            }
        } catch {
            // Fall through to session-only storage below.
        }

        return new MemoryWalletSelectionPersistenceStore();
    };

export const installWalletSelectionPersistence = (
    store: AppStore,
    controllerAid: () => string | null,
    storage: WalletSelectionPersistenceStore | null
): (() => void) => {
    if (storage === null) {
        return () => undefined;
    }

    let lastControllerAid: string | null = null;
    let lastSelectedAid: string | null | undefined;

    return store.subscribe(() => {
        const currentControllerAid = controllerAid();
        if (currentControllerAid === null) {
            lastControllerAid = null;
            lastSelectedAid = undefined;
            return;
        }

        const selectedAid = store.getState().walletSelection.selectedAid;
        if (
            lastControllerAid === currentControllerAid &&
            lastSelectedAid === selectedAid
        ) {
            return;
        }

        lastControllerAid = currentControllerAid;
        lastSelectedAid = selectedAid;
        void storage.save(currentControllerAid, selectedAid).catch(() => {
            // Selection persistence is a convenience; the active session keeps working.
        });
    });
};

export const rehydrateWalletSelection = async ({
    store,
    controllerAid,
    storage,
    canApply,
}: {
    store: AppStore;
    controllerAid: string;
    storage: WalletSelectionPersistenceStore | null;
    canApply: () => boolean;
}): Promise<void> => {
    if (storage === null) {
        return;
    }

    const selectedAtStart = store.getState().walletSelection.selectedAid;
    const record = await storage.load(controllerAid);
    if (!canApply()) {
        return;
    }

    const selectedNow = store.getState().walletSelection.selectedAid;
    if (
        record?.selectedAid !== null &&
        record?.selectedAid !== undefined &&
        selectedNow === selectedAtStart
    ) {
        store.dispatch(walletAidSelected({ aid: record.selectedAid }));
    }
};
