import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime';
import type { MultisigCreateDraft } from '../../src/domain/multisig/multisigTypes';
import { thresholdSpecForMembers } from '../../src/domain/multisig/multisigThresholds';
import {
    startMultisigInceptionService,
    startMultisigRotationService,
} from '../../src/services/multisig.service';

const runServiceOperation = async <T>(
    operation: () => EffectionOperation<T>
): Promise<T> => {
    const runtime = createAppRuntime({ storage: null });
    try {
        return await runtime.runWorkflow(operation, {
            scope: 'app',
            track: false,
        });
    } finally {
        await runtime.destroy();
    }
};

describe('multisig service guards', () => {
    it('rejects invalid multisig drafts before protocol submission', async () => {
        const fakeClient = {} as SignifyClient;
        const validThreshold = thresholdSpecForMembers(['Ea', 'Eb']);
        const baseDraft: MultisigCreateDraft = {
            groupAlias: 'invalid-group',
            localMemberName: 'member-a',
            localMemberAid: 'Ea',
            members: [],
            signingMemberAids: ['Ea', 'Eb'],
            rotationMemberAids: ['Ea', 'Eb'],
            signingThreshold: validThreshold,
            rotationThreshold: validThreshold,
            witnessMode: 'none',
        };

        await expect(
            runServiceOperation(() =>
                startMultisigInceptionService({
                    client: fakeClient,
                    draft: {
                        ...baseDraft,
                        signingThreshold: {
                            mode: 'customFlat',
                            weights: [],
                        },
                    },
                })
            )
        ).rejects.toThrow('Signing threshold requires at least one member.');

        await expect(
            runServiceOperation(() =>
                startMultisigInceptionService({
                    client: fakeClient,
                    draft: {
                        ...baseDraft,
                        localMemberAid: 'Ec',
                    },
                })
            )
        ).rejects.toThrow('The local member must be in the signing set.');
    });

    it('rejects multisig inception when a remote member cannot receive the request', async () => {
        const validThreshold = thresholdSpecForMembers(['Ea', 'Eb']);
        const fakeClient = {
            identifiers: () => ({
                get: async () => ({
                    name: 'member-a',
                    prefix: 'Ea',
                }),
                list: async () => [{ name: 'member-a', prefix: 'Ea' }],
            }),
            contacts: () => ({
                list: async () => [
                    {
                        id: 'Eb',
                        alias: 'member-b',
                        ends: {},
                    },
                ],
            }),
        } as unknown as SignifyClient;

        await expect(
            runServiceOperation(() =>
                startMultisigInceptionService({
                    client: fakeClient,
                    draft: {
                        groupAlias: 'delivery-fails',
                        localMemberName: 'member-a',
                        localMemberAid: 'Ea',
                        members: [
                            {
                                aid: 'Ea',
                                alias: 'member-a',
                                source: 'local',
                            },
                            {
                                aid: 'Eb',
                                alias: 'member-b',
                                source: 'contact',
                            },
                        ],
                        signingMemberAids: ['Ea', 'Eb'],
                        rotationMemberAids: ['Ea', 'Eb'],
                        signingThreshold: validThreshold,
                        rotationThreshold: validThreshold,
                        witnessMode: 'none',
                    },
                })
            )
        ).rejects.toThrow('Resolve member agent OOBIs before creating the group');
    });

    it('rejects rotation when a referenced member key state cannot be resolved', async () => {
        const fakeClient = {
            identifiers: () => ({
                get: async () => ({ name: 'member-a', prefix: 'Ea' }),
            }),
            keyStates: () => ({
                query: async () => {
                    throw new Error('missing key state');
                },
            }),
        } as unknown as SignifyClient;

        await expect(
            runServiceOperation(() =>
                startMultisigRotationService({
                    client: fakeClient,
                    draft: {
                        groupAlias: 'group-a',
                        localMemberName: 'member-a',
                        signingMemberAids: ['Eunknown'],
                        rotationMemberAids: ['Eunknown'],
                        nextThreshold: thresholdSpecForMembers(['Eunknown']),
                    },
                })
            )
        ).rejects.toThrow('missing key state');
    });

    it('rejects rotation before Signify when group signing members are unavailable', async () => {
        const fakeClient = {
            identifiers: () => ({
                get: async () => ({ name: 'member-a', prefix: 'Ea' }),
                members: async () => ({
                    signing: [],
                    rotation: [{ prefix: 'Ea' }],
                }),
            }),
        } as unknown as SignifyClient;

        await expect(
            runServiceOperation(() =>
                startMultisigRotationService({
                    client: fakeClient,
                    draft: {
                        groupAlias: 'group-a',
                        localMemberName: 'member-a',
                        signingMemberAids: [],
                        rotationMemberAids: ['Ea'],
                        nextThreshold: thresholdSpecForMembers(['Ea']),
                    },
                })
            )
        ).rejects.toThrow('signing members could not be loaded');
    });
});
