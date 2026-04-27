import type { SignifyClient } from 'signify-ts';
import type { ContactRecord } from '../../domain/contacts/contactTypes';
import type { NotificationRecord } from '../../state/notifications.slice';

/**
 * Normalized KERIA notification inventory plus app-derived challenge notices.
 */
export interface NotificationInventorySnapshot {
    notifications: NotificationRecord[];
    loadedAt: string;
    unknownChallengeSenders: UnknownChallengeSenderNotice[];
}

/**
 * Challenge request metadata that needs an app-level notice because the sender
 * is not yet a resolved contact.
 */
export interface UnknownChallengeSenderNotice {
    notificationId: string;
    exnSaid: string;
    senderAid: string;
    createdAt: string;
}

/** Shared context for protocol notification hydrators. */
export interface NotificationHydrationContext {
    client: SignifyClient;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}

/** Contact-aware context used by challenge request hydration. */
export interface ChallengeHydrationContext extends NotificationHydrationContext {
    contacts: readonly ContactRecord[];
    tombstonedExnSaids: ReadonlySet<string>;
}

/** Result returned by challenge hydrators because unknown senders raise app notices. */
export interface ChallengeHydrationResult {
    notifications: NotificationRecord[];
    unknownChallengeSenders: UnknownChallengeSenderNotice[];
}

