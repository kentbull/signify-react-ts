import { appConfig, type AppConfig } from '../config';
import { buildIssueableCredentialTypes } from '../domain/credentials/credentialCatalog';

export const ISSUEABLE_CREDENTIAL_TYPES =
    buildIssueableCredentialTypes(appConfig satisfies Pick<AppConfig, 'schemas'>);

export {
    buildIssueableCredentialTypeViews,
    buildIssueableCredentialTypes,
} from '../domain/credentials/credentialCatalog';

export type {
    IssueableCredentialFormKind,
    IssueableCredentialTypeKey,
    IssueableCredentialTypeRecord,
    IssueableCredentialTypeView,
} from '../domain/credentials/credentialCatalog';
