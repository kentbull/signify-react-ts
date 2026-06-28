import { describe, expect, it } from 'vitest';
import {
    thresholdSpecForMembers,
    type MultisigThresholdSpec,
} from '../../src/domain/multisig/multisigThresholds';
import {
    acceptMultisigInceptionService,
    startMultisigInceptionService,
} from '../../src/services/multisig.service';
import { listNotificationsService } from '../../src/services/notifications.service';
import { runServiceOperation, waitForNotification } from '../support/keria';
import {
    assertMembershipAndThresholds,
    createMembers,
    exchangeAllAgentOobis,
    expectGroupConvergence,
    inceptGroup,
    notificationSaid,
    resolveGroupOobiWithObserver,
    requestInput,
    rotateMembersAndGroup,
    startGroupInteraction,
    uniqueAlias,
    authorizeGroupAgents,
} from '../support/multisig';

const flatWeightedThreshold = (
    memberAids: readonly string[]
): MultisigThresholdSpec => ({
    mode: 'customFlat',
    weights: [
        { memberAid: memberAids[0] ?? '', weight: '2/3' },
        { memberAid: memberAids[1] ?? '', weight: '1/2' },
        { memberAid: memberAids[2] ?? '', weight: '1/2' },
    ],
});

const nestedWeightedThreshold = (
    memberAids: readonly string[]
): MultisigThresholdSpec => ({
    mode: 'nestedWeighted',
    clauses: [
        {
            id: 'member-pair',
            weights: [
                { memberAid: memberAids[0] ?? '', weight: '1/2' },
                { memberAid: memberAids[1] ?? '', weight: '1/2' },
            ],
        },
        {
            id: 'member-c',
            weights: [{ memberAid: memberAids[2] ?? '', weight: '1' }],
        },
    ],
});

describe.sequential('multisig lifecycle quality gate', () => {
    it(
        'surfaces two-member inception invitations through app notifications',
        async () => {
            const groupAlias = uniqueAlias('multisig-notification-join');
            const followerGroupAlias = uniqueAlias(
                'multisig-notification-joined'
            );
            const { roles, aliases, aids, memberAids } = await createMembers(
                'multisig-notification-join',
                2
            );
            const initiator = roles[0];
            const acceptor = roles[1];
            const initiatorAid = aids[0];
            const acceptorAid = aids[1];
            if (
                initiator === undefined ||
                acceptor === undefined ||
                initiatorAid === undefined ||
                acceptorAid === undefined
            ) {
                throw new Error('Missing multisig notification test member.');
            }

            await exchangeAllAgentOobis(roles, aliases);

            const threshold = thresholdSpecForMembers(memberAids);
            const creating = runServiceOperation(() =>
                startMultisigInceptionService({
                    client: initiator.client,
                    config: undefined,
                    draft: {
                        groupAlias,
                        localMemberName: aliases[0],
                        localMemberAid: initiatorAid.prefix,
                        members: memberAids.map((aid, index) => ({
                            aid,
                            alias: aliases[index] ?? aid,
                            source:
                                aid === initiatorAid.prefix
                                    ? 'local'
                                    : 'contact',
                        })),
                        signingMemberAids: [...memberAids],
                        rotationMemberAids: [...memberAids],
                        signingThreshold: threshold,
                        rotationThreshold: threshold,
                        witnessMode: 'none',
                    },
                })
            );
            const notification = await waitForNotification(
                acceptor,
                '/multisig/icp'
            );
            const snapshot = await runServiceOperation(() =>
                listNotificationsService({
                    client: acceptor.client,
                    localAids: [acceptorAid.prefix],
                })
            );

            expect(snapshot.notifications).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: notification.i,
                        route: '/multisig/icp',
                        status: 'unread',
                        message: 'Group invitation',
                        multisigRequest: expect.objectContaining({
                            exnSaid: notificationSaid(notification),
                            route: '/multisig/icp',
                            groupAlias: null,
                            status: 'actionable',
                            progress: expect.objectContaining({
                                completed: 1,
                                total: 2,
                                respondedMemberAids: [initiatorAid.prefix],
                                waitingMemberAids: [acceptorAid.prefix],
                            }),
                        }),
                    }),
                ])
            );

            await Promise.all([
                creating,
                runServiceOperation(() =>
                    acceptMultisigInceptionService({
                        client: acceptor.client,
                        input: requestInput(
                            notification,
                            followerGroupAlias,
                            aliases[1]
                        ),
                    })
                ),
            ]);

            const [leaderGroup, followerGroup] = await Promise.all([
                initiator.client.identifiers().get(groupAlias),
                acceptor.client.identifiers().get(followerGroupAlias),
            ]);
            expect(followerGroup.prefix).toBe(leaderGroup.prefix);
        },
        360_000
    );

    it(
        'proves two-member inception, agent authorization, interaction, and rotation',
        async () => {
            const groupAlias = uniqueAlias('multisig-two');
            const { roles, aliases, aids, memberAids } = await createMembers(
                'multisig-two',
                2
            );

            await exchangeAllAgentOobis(roles, aliases);
            await inceptGroup({ roles, aliases, aids, memberAids, groupAlias });
            await expectGroupConvergence(roles, groupAlias);
            await assertMembershipAndThresholds(roles[0], groupAlias, memberAids, [
                '1/2',
                '1/2',
            ]);

            await authorizeGroupAgents({ roles, aliases, groupAlias });
            await resolveGroupOobiWithObserver(roles[0], groupAlias);

            const beforeInteraction = await expectGroupConvergence(
                roles,
                groupAlias
            );
            await startGroupInteraction({
                roles,
                aliases,
                groupAlias,
                data: {
                    i: beforeInteraction.prefix,
                    s: beforeInteraction.sequence,
                    d: beforeInteraction.digest,
                },
            });
            const afterInteraction = await expectGroupConvergence(
                roles,
                groupAlias
            );
            expect(Number(afterInteraction.sequence)).toBe(
                Number(beforeInteraction.sequence) + 1
            );

            await rotateMembersAndGroup({ roles, aliases, groupAlias, memberAids });
            const afterRotation = await expectGroupConvergence(roles, groupAlias);
            expect(Number(afterRotation.sequence)).toBe(
                Number(afterInteraction.sequence) + 1
            );
            await assertMembershipAndThresholds(roles[1], groupAlias, memberAids, [
                '1/2',
                '1/2',
            ]);
        },
        360_000
    );

    it(
        'proves three-member inception, agent authorization, interaction, and rotation',
        async () => {
            const groupAlias = uniqueAlias('multisig-three');
            const { roles, aliases, aids, memberAids } = await createMembers(
                'multisig-three',
                3
            );

            await exchangeAllAgentOobis(roles, aliases);
            await inceptGroup({ roles, aliases, aids, memberAids, groupAlias });
            await expectGroupConvergence(roles, groupAlias);
            await Promise.all(
                roles.map((role) =>
                    assertMembershipAndThresholds(role, groupAlias, memberAids, [
                        '1/3',
                        '1/3',
                        '1/3',
                    ])
                )
            );

            await authorizeGroupAgents({ roles, aliases, groupAlias });
            await resolveGroupOobiWithObserver(roles[0], groupAlias);

            const beforeInteraction = await expectGroupConvergence(
                roles,
                groupAlias
            );
            await startGroupInteraction({
                roles,
                aliases,
                groupAlias,
                data: {
                    i: beforeInteraction.prefix,
                    s: beforeInteraction.sequence,
                    d: beforeInteraction.digest,
                },
            });
            const afterInteraction = await expectGroupConvergence(
                roles,
                groupAlias
            );
            expect(Number(afterInteraction.sequence)).toBe(
                Number(beforeInteraction.sequence) + 1
            );

            await rotateMembersAndGroup({ roles, aliases, groupAlias, memberAids });
            const afterRotation = await expectGroupConvergence(roles, groupAlias);
            expect(Number(afterRotation.sequence)).toBe(
                Number(afterInteraction.sequence) + 1
            );
            await Promise.all(
                roles.map((role) =>
                    assertMembershipAndThresholds(role, groupAlias, memberAids, [
                        '1/3',
                        '1/3',
                        '1/3',
                    ])
                )
            );
        },
        480_000
    );

    it(
        'proves flat weighted three-member inception, interaction, and rotation',
        async () => {
            const groupAlias = uniqueAlias('multisig-flat-weighted');
            const { roles, aliases, aids, memberAids } = await createMembers(
                'multisig-flat-weighted',
                3
            );
            const threshold = flatWeightedThreshold(memberAids);
            const expected = ['2/3', '1/2', '1/2'];

            await exchangeAllAgentOobis(roles, aliases);
            await inceptGroup({
                roles,
                aliases,
                aids,
                memberAids,
                groupAlias,
                signingThreshold: threshold,
                rotationThreshold: threshold,
            });
            await expectGroupConvergence(roles, groupAlias);
            await Promise.all(
                roles.map((role) =>
                    assertMembershipAndThresholds(
                        role,
                        groupAlias,
                        memberAids,
                        expected
                    )
                )
            );

            await authorizeGroupAgents({ roles, aliases, groupAlias });
            await startGroupInteraction({
                roles,
                aliases,
                groupAlias,
                data: { purpose: 'flat-weighted-proof' },
            });
            const afterInteraction = await expectGroupConvergence(
                roles,
                groupAlias
            );

            await rotateMembersAndGroup({
                roles,
                aliases,
                groupAlias,
                memberAids,
                nextThreshold: threshold,
            });
            const afterRotation = await expectGroupConvergence(roles, groupAlias);
            expect(Number(afterRotation.sequence)).toBe(
                Number(afterInteraction.sequence) + 1
            );
            await Promise.all(
                roles.map((role) =>
                    assertMembershipAndThresholds(
                        role,
                        groupAlias,
                        memberAids,
                        expected
                    )
                )
            );
        },
        480_000
    );

    it(
        'proves nested weighted three-member inception, interaction, and rotation',
        async () => {
            const groupAlias = uniqueAlias('multisig-nested-weighted');
            const { roles, aliases, aids, memberAids } = await createMembers(
                'multisig-nested-weighted',
                3
            );
            const threshold = nestedWeightedThreshold(memberAids);
            const expected = [['1/2', '1/2'], ['1']];

            await exchangeAllAgentOobis(roles, aliases);
            await inceptGroup({
                roles,
                aliases,
                aids,
                memberAids,
                groupAlias,
                signingThreshold: threshold,
                rotationThreshold: threshold,
            });
            await expectGroupConvergence(roles, groupAlias);
            await Promise.all(
                roles.map((role) =>
                    assertMembershipAndThresholds(
                        role,
                        groupAlias,
                        memberAids,
                        expected
                    )
                )
            );

            await authorizeGroupAgents({ roles, aliases, groupAlias });
            await startGroupInteraction({
                roles,
                aliases,
                groupAlias,
                data: { purpose: 'nested-weighted-proof' },
            });
            const afterInteraction = await expectGroupConvergence(
                roles,
                groupAlias
            );

            await rotateMembersAndGroup({
                roles,
                aliases,
                groupAlias,
                memberAids,
                nextThreshold: threshold,
            });
            const afterRotation = await expectGroupConvergence(roles, groupAlias);
            expect(Number(afterRotation.sequence)).toBe(
                Number(afterInteraction.sequence) + 1
            );
            await Promise.all(
                roles.map((role) =>
                    assertMembershipAndThresholds(
                        role,
                        groupAlias,
                        memberAids,
                        expected
                    )
                )
            );
        },
        480_000
    );

});
