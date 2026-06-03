import {
    defaultSigningPolicy,
    W3C,
    W3C_PURPOSE_HOLDER_VP_JWT,
    type SignifyClient,
    type W3CHeldCredential,
    type W3CSigningPolicy,
    type W3CSigningRequest,
} from 'signify-ts';

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

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const createHolderPresentationSigningPolicy = (
    client: SignifyClient
): W3CSigningPolicy => {
    const w3c = new W3C(client);
    return async (request: W3CSigningRequest): Promise<boolean | string> => {
        if (request.purpose !== W3C_PURPOSE_HOLDER_VP_JWT) {
            return defaultSigningPolicy(request);
        }

        // Holder VP signing is never auto-approved by the default policy. The
        // UI records an explicit presentation approval, then this policy binds
        // the live KERIA tx back to that approval before the browser signs.
        const presentTxId = request.related;
        const approval = getW3CHolderPresentationApproval(presentTxId);
        if (approval === undefined) {
            return `holder presentation ${presentTxId} was not explicitly approved`;
        }
        if (
            approval.holderAlias !== request.name ||
            approval.holderAid !== request.aid
        ) {
            return `holder presentation ${presentTxId} targets ${request.name}/${request.aid}, but approval is for ${approval.holderAlias}/${approval.holderAid}`;
        }

        const tx = await w3c.presentTx(request.name, presentTxId);
        if (
            tx.holderAid !== approval.holderAid ||
            tx.holderName !== approval.holderAlias
        ) {
            return `holder presentation ${presentTxId} no longer matches the approved holder`;
        }
        const requestId = request.requestId ?? request.d;
        if (tx.signingRequestId !== requestId) {
            return `holder presentation ${presentTxId} signing request does not match the approved transaction`;
        }
        if (stringValue(tx.aud) !== approval.aud) {
            return `holder presentation ${presentTxId} audience does not match the approved request`;
        }
        if (stringValue(tx.nonce) !== approval.nonce) {
            return `holder presentation ${presentTxId} nonce does not match the approved request`;
        }

        const selectedCredentialId = stringValue(tx.selectedCredentialId);
        if (selectedCredentialId === null) {
            return `holder presentation ${presentTxId} did not select a held credential`;
        }
        const held = (await w3c.credential(
            request.name,
            selectedCredentialId
        )) as W3CHeldCredential;
        if (
            stringValue(held.sourceCredentialSaid) !== approval.credentialSaid
        ) {
            return `holder presentation ${presentTxId} selected credential does not match the approved source credential`;
        }
        return true;
    };
};

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
