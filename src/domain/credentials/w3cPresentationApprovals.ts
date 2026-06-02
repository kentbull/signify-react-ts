export interface W3CHolderPresentationApproval {
    presentTxId: string;
    holderAlias: string;
    holderAid: string;
    credentialSaid: string;
    aud: string;
    nonce: string;
    expiresAt: string;
}

const storageKey = 'signify-react-ts:w3c-holder-presentation-approvals';
const memoryApprovals = new Map<string, W3CHolderPresentationApproval>();

export const recordW3CHolderPresentationApproval = (
    approval: W3CHolderPresentationApproval
): void => {
    memoryApprovals.set(approval.presentTxId, approval);
    writeApprovals(readApprovals().set(approval.presentTxId, approval));
};

export const getW3CHolderPresentationApproval = (
    presentTxId: string
): W3CHolderPresentationApproval | undefined => {
    const approval = readApprovals().get(presentTxId);
    if (approval === undefined) {
        return undefined;
    }
    if (Date.parse(approval.expiresAt) <= Date.now()) {
        clearW3CHolderPresentationApproval(presentTxId);
        return undefined;
    }
    return approval;
};

export const clearW3CHolderPresentationApproval = (
    presentTxId: string
): void => {
    memoryApprovals.delete(presentTxId);
    const approvals = readApprovals();
    approvals.delete(presentTxId);
    writeApprovals(approvals);
};

const readApprovals = (): Map<string, W3CHolderPresentationApproval> => {
    const approvals = new Map(memoryApprovals);
    const stored = readStoredApprovals();
    if (stored !== null) {
        for (const approval of stored) {
            approvals.set(approval.presentTxId, approval);
        }
    }
    return approvals;
};

const writeApprovals = (
    approvals: Map<string, W3CHolderPresentationApproval>
): void => {
    memoryApprovals.clear();
    for (const [presentTxId, approval] of approvals) {
        memoryApprovals.set(presentTxId, approval);
    }
    const storage = browserStorage();
    if (storage === null) {
        return;
    }
    storage.setItem(storageKey, JSON.stringify([...approvals.values()]));
};

const readStoredApprovals = (): W3CHolderPresentationApproval[] | null => {
    const storage = browserStorage();
    if (storage === null) {
        return null;
    }
    const raw = storage.getItem(storageKey);
    if (raw === null) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return null;
        }
        return parsed.filter(isApprovalRecord);
    } catch {
        return null;
    }
};

const browserStorage = (): Storage | null =>
    typeof globalThis.localStorage === 'undefined'
        ? null
        : globalThis.localStorage;

const isApprovalRecord = (
    value: unknown
): value is W3CHolderPresentationApproval => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return [
        'presentTxId',
        'holderAlias',
        'holderAid',
        'credentialSaid',
        'aud',
        'nonce',
        'expiresAt',
    ].every((field) => typeof record[field] === 'string');
};
