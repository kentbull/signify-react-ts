/**
 * Prefix for app-created notifications backed by challenge request EXNs.
 */
export const SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX = 'challenge-request:';

/**
 * Prefix for generic app-created notifications backed by exchange EXNs.
 */
export const SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX = 'exchange:';

/**
 * Build the stable synthetic notification id for one challenge request EXN.
 */
export const syntheticChallengeNotificationId = (exnSaid: string): string =>
    `${SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX}${exnSaid}`;

/**
 * Test whether an id belongs to the synthetic challenge request namespace.
 */
export const isSyntheticChallengeNotificationId = (id: string): boolean =>
    id.startsWith(SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX);

/**
 * Build the stable synthetic notification id for a non-notification EXN.
 */
export const syntheticExchangeNotificationId = (exnSaid: string): string =>
    `${SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX}${exnSaid}`;

/**
 * Test whether an id belongs to any synthetic exchange-backed namespace.
 */
export const isSyntheticExchangeNotificationId = (id: string): boolean =>
    isSyntheticChallengeNotificationId(id) ||
    id.startsWith(SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX);

