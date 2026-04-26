import type { Operation as EffectionOperation } from 'effection';
import { describe, expect, it } from 'vitest';
import {
    createContactRuntimeCommands,
    createCredentialRuntimeCommands,
    createDelegationRuntimeCommands,
    createIdentifierRuntimeCommands,
    createMultisigRuntimeCommands,
    type BackgroundWorkflowRunOptions,
    type RuntimeCommandContext,
} from '../../src/app/runtimeCommands';
import { defaultIdentifierCreateDraft } from '../../src/domain/identifiers/identifierHelpers';
import type { DelegationRequestNotification } from '../../src/state/notifications.slice';
import { createAppStore } from '../../src/state/store';

const makeContext = () => {
    const store = createAppStore();
    const startedOptions: BackgroundWorkflowRunOptions<unknown>[] = [];
    const context: RuntimeCommandContext = {
        runWorkflow: (async () => undefined) as RuntimeCommandContext['runWorkflow'],
        startBackgroundWorkflow: (<T>(
            _operation: () => EffectionOperation<T>,
            options: BackgroundWorkflowRunOptions<T>
        ) => {
            startedOptions.push(
                options as BackgroundWorkflowRunOptions<unknown>
            );
            const requestId = options.requestId ?? 'generated-request';
            return {
                status: 'accepted',
                requestId,
                operationRoute: `/operations/${requestId}`,
            };
        }) as RuntimeCommandContext['startBackgroundWorkflow'],
        createRequestId: () => 'generated-request',
        getState: () => store.getState(),
    };

    return { context, startedOptions };
};

describe('runtime command adapters', () => {
    it('builds identifier create background metadata without runtime domain ownership', () => {
        const { context, startedOptions } = makeContext();
        const commands = createIdentifierRuntimeCommands(context);
        const draft = {
            ...defaultIdentifierCreateDraft(),
            name: 'alice',
            delegation: {
                mode: 'delegated',
                delegatorAid: 'Edelegator',
            },
        };

        const started = commands.startCreate(draft, {
            requestId: 'identifier-request',
        });

        expect(started).toEqual({
            status: 'accepted',
            requestId: 'identifier-request',
            operationRoute: '/operations/identifier-request',
        });
        expect(startedOptions[0]).toMatchObject({
            label: 'Creating identifier alice',
            title: 'Create delegated identifier alice',
            kind: 'createDelegatedIdentifier',
            resourceKeys: [
                'identifier:name:alice',
                'delegation:delegator:Edelegator:name:alice',
            ],
            resultRoute: { label: 'View identifiers', path: '/identifiers' },
        });
        expect(startedOptions[0]?.payloadDetails).toBeDefined();
    });

    it('builds contact resolve and OOBI metadata with copyable payload extractors', () => {
        const { context, startedOptions } = makeContext();
        const commands = createContactRuntimeCommands(context);

        commands.startResolve({
            oobi: ' http://127.0.0.1:3902/oobi/Ealice/agent ',
            alias: 'Alice',
        });
        commands.startGenerateOobi({
            identifier: ' alice ',
            role: 'agent',
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Resolving contact Alice',
            title: 'Resolve contact OOBI',
            kind: 'resolveContact',
            resourceKeys: [
                'contact:oobi:http://127.0.0.1:3902/oobi/Ealice/agent',
                'contact:alias:Alice',
            ],
            resultRoute: { label: 'View contacts', path: '/contacts' },
        });
        expect(startedOptions[0]?.payloadDetails).toBeDefined();
        expect(startedOptions[1]).toMatchObject({
            label: 'Generating agent OOBI for alice',
            title: 'Generate agent OOBI',
            kind: 'generateOobi',
            resourceKeys: ['oobi:alice:agent'],
        });
        expect(startedOptions[1]?.payloadDetails).toBeDefined();
    });

    it('builds delegation approval metadata with delegation payload extraction', () => {
        const { context, startedOptions } = makeContext();
        const commands = createDelegationRuntimeCommands(context);
        const request: DelegationRequestNotification = {
            notificationId: 'note-1',
            delegatorAid: 'Edelegator',
            delegateAid: 'Edelegate',
            delegateEventSaid: 'Eevent',
            sequence: '0',
            anchor: { i: 'Edelegate', s: '0', d: 'Eevent' },
            sourceAid: 'Edelegate',
            createdAt: '2026-04-21T00:00:00.000Z',
            status: 'pending',
        };

        commands.startApprove({
            notificationId: 'note-1',
            delegatorName: 'root',
            request,
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Approving delegation for Edelegate',
            title: 'Approve delegation',
            kind: 'approveDelegation',
            resourceKeys: [
                'delegation:approval:note-1',
                'delegation:delegate:Edelegate',
            ],
            resultRoute: {
                label: 'View notifications',
                path: '/notifications',
            },
        });
        expect(startedOptions[0]?.payloadDetails).toBeDefined();
    });

    it('builds credential issue, grant, and admit metadata', () => {
        const { context, startedOptions } = makeContext();
        const commands = createCredentialRuntimeCommands(context);

        commands.startIssue({
            issuerAlias: 'issuer',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            registryId: 'registry-1',
            schemaSaid: 'Eschema',
            attributes: {
                i: 'Eholder',
                fullName: 'Ada Holder',
                voterId: 'VOTER-1',
                precinctId: 'P-1',
                county: 'Demo',
                jurisdiction: 'Demo City',
                electionId: '2026-demo',
                eligible: true,
                expires: '2026-12-31',
            },
        });
        commands.startGrant({
            issuerAlias: 'issuer',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            credentialSaid: 'Ecredential',
        });
        commands.startAdmit({
            holderAlias: 'holder',
            holderAid: 'Eholder',
            notificationId: 'note-1',
            grantSaid: 'Egrant',
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Issuing credential to Eholder',
            title: 'Issue SEDI voter credential',
            kind: 'issueCredential',
            resourceKeys: ['credential:issue:Eissuer:Eholder:VOTER-1'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
        });
        expect(startedOptions[1]).toMatchObject({
            label: 'Granting credential Ecredential',
            title: 'Grant credential',
            kind: 'grantCredential',
            resourceKeys: ['credential:Ecredential:grant'],
        });
        expect(startedOptions[2]).toMatchObject({
            label: 'Admitting credential grant Egrant',
            title: 'Admit credential grant',
            kind: 'admitCredential',
            resourceKeys: ['grant:Egrant:admit'],
        });
    });

    it('builds multisig accept metadata with proposal and group resources', () => {
        const { context, startedOptions } = makeContext();
        const commands = createMultisigRuntimeCommands(context);

        commands.startAcceptInteraction({
            notificationId: 'note-1',
            exnSaid: 'Eexn',
            groupAlias: 'team',
            localMemberName: 'alice',
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Accepting multisig interaction team',
            title: 'Accept multisig interaction',
            kind: 'acceptMultisigInteraction',
            resourceKeys: [
                'multisig:proposal:Eexn',
                'multisig:group:team:event',
            ],
            resultRoute: { label: 'View multisig', path: '/multisig' },
        });
    });
});
