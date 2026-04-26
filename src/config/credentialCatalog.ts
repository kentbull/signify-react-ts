import { appConfig, type AppConfig } from '../config';
import {
    buildIssueableCredentialTypes,
    buildIssueableCredentialTypeViews,
} from '../domain/credentials/credentialCatalog';

export const ISSUEABLE_CREDENTIAL_TYPES = buildIssueableCredentialTypes(
    appConfig satisfies Pick<AppConfig, 'schemas'>
);

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
