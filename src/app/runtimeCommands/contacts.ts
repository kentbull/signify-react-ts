import type { Operation as EffectionOperation } from 'effection';
import { aliasForOobiResolution } from '../../domain/contacts/contactHelpers';
import type {
    ContactInventorySnapshot,
    OobiRole,
    ResolveContactInput,
    ResolveContactResult,
} from '../../services/contacts.service';
import type { GeneratedOobiRecord } from '../../state/contacts.slice';
import {
    deleteContactOp,
    generateOobiOp,
    listIdentifierOobisOp,
    liveSessionInventoryOp,
    resolveContactOobiOp,
    syncSessionInventoryOp,
    updateContactAliasOp,
    type GenerateOobiInput,
    type ListIdentifierOobisInput,
    type SessionInventorySnapshot,
    type UpdateContactAliasInput,
} from '../../workflows/contacts.op';
import { contactsRoute } from './helpers';
import { oobiPayloadDetails } from './payloadDetails';
import type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RuntimeCommandContext,
    WorkflowRunOptions,
} from './types';

export interface ContactRuntimeCommands {
    syncInventory(
        options?: WorkflowRunOptions
    ): Promise<SessionInventorySnapshot>;
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
): ContactRuntimeCommands => ({
    syncInventory: syncContactInventory(context),
    getIdentifierOobi: getIdentifierOobi(context),
    listIdentifierOobis: listIdentifierOobis(context),
    startGenerateOobi: startGenerateOobi(context),
    startResolve: startResolveContact(context),
    startDelete: startDeleteContact(context),
    startUpdateAlias: startUpdateContactAlias(context),
    liveInventory: () => liveSessionInventoryOp(),
});

const syncContactInventory =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<SessionInventorySnapshot> =>
        context.runWorkflow(() => syncSessionInventoryOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const getIdentifierOobi =
    (context: RuntimeCommandContext) =>
    (
        input: GenerateOobiInput,
        options: WorkflowRunOptions = {}
    ): Promise<GeneratedOobiRecord> =>
        context.runWorkflow(() => generateOobiOp(input), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'generateOobi',
            track: options.track ?? false,
        });

const listIdentifierOobis =
    (context: RuntimeCommandContext) =>
    (
        identifier: string,
        roles: readonly OobiRole[],
        options: WorkflowRunOptions = {}
    ): Promise<GeneratedOobiRecord[]> => {
        const input: ListIdentifierOobisInput = { identifier, roles };
        return context.runWorkflow(() => listIdentifierOobisOp(input), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'workflow',
            track: options.track ?? false,
        });
    };

const startGenerateOobi =
    (context: RuntimeCommandContext) =>
    (
        input: GenerateOobiInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const identifier = input.identifier.trim();
        return context.startBackgroundWorkflow(
            () => generateOobiOp({ identifier, role: input.role }),
            generateOobiOptions(identifier, input.role, options)
        );
    };

const startResolveContact =
    (context: RuntimeCommandContext) =>
    (
        input: ResolveContactInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult => {
        const resolved = normalizedContactResolution(input);
        return context.startBackgroundWorkflow(
            () => resolveContactOobiOp(resolved),
            resolveContactOptions(resolved, options)
        );
    };

const startDeleteContact =
    (context: RuntimeCommandContext) =>
    (
        contactId: string,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => deleteContactOp(contactId),
            deleteContactOptions(contactId, options)
        );

const startUpdateContactAlias =
    (context: RuntimeCommandContext) =>
    (
        input: UpdateContactAliasInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => updateContactAliasOp(input),
            updateContactAliasOptions(input, options)
        );

const generateOobiOptions = (
    identifier: string,
    role: OobiRole,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<GeneratedOobiRecord> => ({
    requestId: options.requestId,
    label: `Generating ${role} OOBI for ${identifier}`,
    title: `Generate ${role} OOBI`,
    description:
        role === 'agent'
            ? 'Authorizes the agent endpoint role if needed, then fetches an identifier OOBI.'
            : 'Fetches witnessed identifier OOBIs from KERIA.',
    kind: 'generateOobi',
    resourceKeys: [`oobi:${identifier}:${role}`],
    resultRoute: contactsRoute,
    successNotification: {
        title: 'OOBI generated',
        message: `Generated a ${role} OOBI for ${identifier}.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'OOBI generation failed',
        message: `The ${role} OOBI generation for ${identifier} failed.`,
        severity: 'error',
    },
    payloadDetails: oobiPayloadDetails,
});

const normalizedContactResolution = (
    input: ResolveContactInput
): ResolveContactInput => {
    const oobi = input.oobi.trim();
    return {
        oobi,
        alias: aliasForOobiResolution(oobi, input.alias),
    };
};

const resolveContactOptions = (
    input: ResolveContactInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<ResolveContactResult> => ({
    requestId: options.requestId,
    label:
        input.alias === null
            ? 'Resolving contact OOBI'
            : `Resolving contact ${input.alias}`,
    title: 'Resolve contact OOBI',
    description:
        'Submits an OOBI to KERIA and refreshes contact inventory after the operation completes.',
    kind: 'resolveContact',
    resourceKeys: contactResolutionResourceKeys(input),
    resultRoute: contactsRoute,
    successNotification: {
        title: 'Contact resolved',
        message:
            input.alias === null
                ? 'The contact OOBI resolved successfully.'
                : `${input.alias} resolved successfully.`,
        severity: 'success',
    },
    failureNotification: {
        title: 'Contact resolution failed',
        message: 'The OOBI resolution failed.',
        severity: 'error',
    },
    payloadDetails: oobiPayloadDetails,
});

const deleteContactOptions = (
    contactId: string,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<ContactInventorySnapshot> => ({
    requestId: options.requestId,
    label: `Deleting contact ${contactId}`,
    title: 'Delete contact',
    description: 'Deletes a KERIA contact and refreshes inventory.',
    kind: 'deleteContact',
    resourceKeys: [`contact:${contactId}`],
    resultRoute: contactsRoute,
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
});

const updateContactAliasOptions = (
    input: UpdateContactAliasInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<ContactInventorySnapshot> => ({
    requestId: options.requestId,
    label: `Updating contact ${input.contactId}`,
    title: 'Update contact alias',
    description: 'Updates local KERIA contact metadata.',
    kind: 'updateContact',
    resourceKeys: [`contact:${input.contactId}`],
    resultRoute: contactsRoute,
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
});

const contactResolutionResourceKeys = (
    input: ResolveContactInput
): string[] => [
    `contact:oobi:${input.oobi}`,
    ...(input.alias === null ? [] : [`contact:alias:${input.alias}`]),
];
