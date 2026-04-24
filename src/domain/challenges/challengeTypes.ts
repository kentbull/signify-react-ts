/** Direction of a challenge relative to this local app. */
export type ChallengeDirection = 'issued' | 'received';

/** Lifecycle state for challenge/response verification. */
export type ChallengeStatus = 'pending' | 'responded' | 'verified' | 'failed';

/** Origin for a challenge record in session state. */
export type ChallengeSource = 'keria' | 'workflow';

/** Durable summary of one challenge exchange. */
export interface ChallengeRecord {
    id: string;
    source?: ChallengeSource;
    direction: ChallengeDirection;
    role: string;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier?: string | null;
    localAid?: string | null;
    words: string[];
    wordsHash?: string | null;
    responseSaid?: string | null;
    authenticated: boolean;
    status: ChallengeStatus;
    result: string | null;
    error?: string | null;
    generatedAt?: string | null;
    sentAt?: string | null;
    verifiedAt?: string | null;
    updatedAt: string;
}

/**
 * In-progress challenge words kept only for the local session/controller.
 *
 * These words are intentionally not part of persisted app state.
 */
export interface StoredChallengeWordsRecord {
    challengeId: string;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier: string;
    localAid?: string | null;
    words: string[];
    wordsHash: string;
    strength: number;
    generatedAt: string;
    updatedAt: string;
    status: 'pending' | 'failed';
}
