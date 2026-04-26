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

export interface CredentialSubjectProjectionContext {
    schemaSaid: string | null;
    credentialTypes: readonly IssueableCredentialTypeRecord[];
}

interface CredentialSubjectProjector {
    formKind: IssueableCredentialFormKind;
    project(
        subject: Record<string, unknown> | null
    ): CredentialSubjectAttributes | null;
    serialize(
        subject: Record<string, unknown> | null
    ): Record<string, string | boolean>;
}

const credentialSubjectProjectors: readonly CredentialSubjectProjector[] = [
    {
        formKind: SEDI_VOTER_ID_FORM_KIND,
        project: sediVoterAttributesFromSubject,
        serialize: serializableCredentialSubjectAttributes,
    },
];

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
