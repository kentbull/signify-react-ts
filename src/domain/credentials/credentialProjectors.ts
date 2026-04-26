import type {
    IssueableCredentialFormKind,
    IssueableCredentialTypeRecord,
} from './credentialCatalog';
import type { CredentialSubjectAttributes } from './credentialTypes';
import {
    SEDI_VOTER_ID_FORM_KIND,
    sediVoterAttributesFromSubject,
    serializableCredentialSubjectAttributes,
} from './sediVoterId';

/**
 * Schema context used to select the right credential-subject projector.
 *
 * The projector boundary prevents generic KERIA/ACDC mapping code from
 * directly importing schema-specific logic such as SEDI Voter ID parsing.
 */
export interface CredentialSubjectProjectionContext {
    schemaSaid: string | null;
    credentialTypes: readonly IssueableCredentialTypeRecord[];
}

/**
 * Internal adapter contract for one schema-specific credential subject mapper.
 */
interface CredentialSubjectProjector {
    formKind: IssueableCredentialFormKind;
    project(
        subject: Record<string, unknown> | null
    ): CredentialSubjectAttributes | null;
    serialize(
        subject: Record<string, unknown> | null
    ): Record<string, string | boolean>;
}

/**
 * Registry of schema-specific ACDC subject projectors known by the app.
 *
 * Adding another credential type should add a schema-specific domain package
 * and register its projector here, not widen generic credential mappings.
 */
const credentialSubjectProjectors: readonly CredentialSubjectProjector[] = [
    {
        formKind: SEDI_VOTER_ID_FORM_KIND,
        project: sediVoterAttributesFromSubject,
        serialize: serializableCredentialSubjectAttributes,
    },
];

/**
 * Resolve the schema-specific projector for a credential catalog entry.
 */
const projectorForContext = ({
    schemaSaid,
    credentialTypes,
}: CredentialSubjectProjectionContext): CredentialSubjectProjector | null => {
    if (schemaSaid === null) {
        return null;
    }

    const credentialType =
        credentialTypes.find((type) => type.schemaSaid === schemaSaid) ?? null;
    if (credentialType === null) {
        return null;
    }

    return (
        credentialSubjectProjectors.find(
            (projector) => projector.formKind === credentialType.formKind
        ) ?? null
    );
};

/** Project schema-specific ACDC subject data into the typed app credential shape. */
export const projectCredentialSubjectAttributes = ({
    subject,
    context,
}: {
    subject: Record<string, unknown> | null;
    context: CredentialSubjectProjectionContext;
}): CredentialSubjectAttributes | null =>
    projectorForContext(context)?.project(subject) ?? null;

/** Serialize schema-specific ACDC subject data for compact IPEX notification facts. */
export const serializeCredentialSubjectAttributes = ({
    subject,
    context,
}: {
    subject: Record<string, unknown> | null;
    context: CredentialSubjectProjectionContext;
}): Record<string, string | boolean> =>
    projectorForContext(context)?.serialize(subject) ?? {};
