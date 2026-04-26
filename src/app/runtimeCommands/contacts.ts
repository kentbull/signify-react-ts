import type { Operation as EffectionOperation } from 'effection';
import { aliasForOobiResolution } from '../../domain/contacts/contactHelpers';
import type { ResolveContactInput } from '../../services/contacts.service';
import type { GeneratedOobiRecord } from '../../state/contacts.slice';
import {
    deleteContactOp,
    generateOobiOp,
    liveSessionInventoryOp,
    resolveContactOobiOp,
    syncSessionInventoryOp,
    updateContactAliasOp,
    type GenerateOobiInput,
    type SessionInventorySnapshot,
    type UpdateContactAliasInput,
} from '../../workflows/contacts.op';
import { oobiPayloadDetails } from './payloadDetails';
import type {
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RuntimeCommandContext,
    WorkflowRunOptions,
} from './types';

export interface ContactRuntimeCommands {
    syncInventory(options?: WorkflowRunOptions): Promise<SessionInventorySnapshot>;
    getIdentifierOobi(
        input: GenerateOobiInput,
        options?: WorkflowRunOptions
    ): Promise<GeneratedOobiRecord>;
    listIdentifierOobis(
        identifier: string,
        roles: readonly GenerateOobiInput['role'][],
        options?: WorkflowRunOptions
    ): Promise<GeneratedOobiRecord[]>;
    startGenerateOobi(
        input: GenerateOobiInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startResolve(
        input: ResolveContactInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startDelete(
        contactId: string,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startUpdateAlias(
        input: UpdateContactAliasInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    liveInventory(): EffectionOperation<void>;
}

/**
 * Route-facing contact and OOBI commands.
 */
export const createContactRuntimeCommands = (
    context: RuntimeCommandContext
): ContactRuntimeCommands => {
    const getIdentifierOobi = (
        input: GenerateOobiInput,
        options: WorkflowRunOptions = {}
    ): Promise<GeneratedOobiRecord> =>
        context.runWorkflow(() => generateOobiOp(input), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'generateOobi',
            track: options.track ?? false,
        });

    return {
        syncInventory: (options = {}) =>
            context.runWorkflow(() => syncSessionInventoryOp(), {
                ...options,
                label: options.label,
                kind: options.kind ?? 'syncInventory',
                track: options.track ?? false,
            }),

        getIdentifierOobi,

        listIdentifierOobis: async (identifier, roles, options = {}) => {
            const records: GeneratedOobiRecord[] = [];
            for (const role of roles) {
                records.push(
                    await getIdentifierOobi(
                        { identifier, role },
                        {
                            ...options,
                            label: options.label,
                            track: options.track ?? false,
                        }
                    )
                );
            }

            return records;
        },

        startGenerateOobi: (input, options = {}) => {
            const identifier = input.identifier.trim();
            return context.startBackgroundWorkflow(
                () => generateOobiOp({ identifier, role: input.role }),
                {
                    requestId: options.requestId,
                    label: `Generating ${input.role} OOBI for ${identifier}`,
                    title: `Generate ${input.role} OOBI`,
                    description:
                        input.role === 'agent'
                            ? 'Authorizes the agent endpoint role if needed, then fetches an identifier OOBI.'
                            : 'Fetches witnessed identifier OOBIs from KERIA.',
                    kind: 'generateOobi',
                    resourceKeys: [`oobi:${identifier}:${input.role}`],
                    resultRoute: { label: 'View contacts', path: '/contacts' },
                    successNotification: {
                        title: 'OOBI generated',
                        message: `Generated a ${input.role} OOBI for ${identifier}.`,
                        severity: 'success',
                    },
                    failureNotification: {
                        title: 'OOBI generation failed',
                        message: `The ${input.role} OOBI generation for ${identifier} failed.`,
                        severity: 'error',
                    },
                    payloadDetails: oobiPayloadDetails,
                }
            );
        },

        startResolve: (input, options = {}) => {
            const oobi = input.oobi.trim();
            const alias = aliasForOobiResolution(oobi, input.alias);
            const resourceKeys = [`contact:oobi:${oobi}`];
            if (alias !== null) {
                resourceKeys.push(`contact:alias:${alias}`);
            }

            return context.startBackgroundWorkflow(
                () => resolveContactOobiOp({ oobi, alias }),
                {
                    requestId: options.requestId,
                    label:
                        alias === null
                            ? 'Resolving contact OOBI'
                            : `Resolving contact ${alias}`,
                    title: 'Resolve contact OOBI',
                    description:
                        'Submits an OOBI to KERIA and refreshes contact inventory after the operation completes.',
                    kind: 'resolveContact',
                    resourceKeys,
                    resultRoute: { label: 'View contacts', path: '/contacts' },
                    successNotification: {
                        title: 'Contact resolved',
                        message:
                            alias === null
                                ? 'The contact OOBI resolved successfully.'
                                : `${alias} resolved successfully.`,
                        severity: 'success',
                    },
                    failureNotification: {
                        title: 'Contact resolution failed',
                        message: 'The OOBI resolution failed.',
                        severity: 'error',
                    },
                    payloadDetails: oobiPayloadDetails,
                }
            );
        },

        startDelete: (contactId, options = {}) =>
            context.startBackgroundWorkflow(() => deleteContactOp(contactId), {
                requestId: options.requestId,
                label: `Deleting contact ${contactId}`,
                title: 'Delete contact',
                description:
                    'Deletes a KERIA contact and refreshes inventory.',
                kind: 'deleteContact',
                resourceKeys: [`contact:${contactId}`],
                resultRoute: { label: 'View contacts', path: '/contacts' },
                successNotification: {
                    title: 'Contact deleted',
                    message: `${contactId} was deleted.`,
                    severity: 'success',
                },
                failureNotification: {
                    title: 'Contact deletion failed',
                    message: `${contactId} could not be deleted.`,
                    severity: 'error',
                },
            }),

        startUpdateAlias: (input, options = {}) =>
            context.startBackgroundWorkflow(() => updateContactAliasOp(input), {
                requestId: options.requestId,
                label: `Updating contact ${input.contactId}`,
                title: 'Update contact alias',
                description: 'Updates local KERIA contact metadata.',
                kind: 'updateContact',
                resourceKeys: [`contact:${input.contactId}`],
                resultRoute: { label: 'View contacts', path: '/contacts' },
                successNotification: {
                    title: 'Contact updated',
                    message: `${input.contactId} was updated.`,
                    severity: 'success',
                },
                failureNotification: {
                    title: 'Contact update failed',
                    message: `${input.contactId} could not be updated.`,
                    severity: 'error',
                },
            }),

        liveInventory: () => liveSessionInventoryOp(),
    };
};
