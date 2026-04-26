import { appConfig, type AppConfig } from '../config';
import {
    buildIssueableCredentialTypes,
    buildIssueableCredentialTypeViews,
} from '../domain/credentials/credentialCatalog';

/**
 * App-bound credential catalog assembled from runtime configuration.
 *
 * Keep config import here instead of in `src/domain`: domain modules define
 * catalog semantics, while this module chooses which schemas the demo enables.
 */
export const ISSUEABLE_CREDENTIAL_TYPES = buildIssueableCredentialTypes(
    appConfig satisfies Pick<AppConfig, 'schemas'>
);

/**
 * Re-export pure catalog helpers for callers that already depend on the
 * app-level catalog entry point.
 */
export {
    buildIssueableCredentialTypes,
    buildIssueableCredentialTypeViews,
};

export type {
    IssueableCredentialFormKind,
    IssueableCredentialTypeKey,
    IssueableCredentialTypeRecord,
    IssueableCredentialTypeView,
} from '../domain/credentials/credentialCatalog';
