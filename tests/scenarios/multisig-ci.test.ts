import { describe, expect, it } from 'vitest';
import { thresholdSpecForMembers } from '../../src/domain/multisig/multisigThresholds';
import {
    MULTISIG_ICP_ROUTE,
    acceptMultisigInceptionService,
    startMultisigInceptionService,
} from '../../src/services/multisig.service';
import { listNotificationsService } from '../../src/services/notifications.service';
import { runServiceOperation, waitForNotification } from '../support/keria';
import {
    assertMembershipAndThresholds,
    authorizeGroupAgents,
    createMembers,
    exchangeAllAgentOobis,
    expectGroupConvergence,
    notificationSaid,
    requestInput,
    rotateMembersAndGroup,
    startGroupInteraction,
    uniqueAlias,
} from '../support/multisig';

describe.sequential('required CI multisig canary', () => {
    it(
        'proves two-member invitation, acceptance, interaction, and rotation',
        async () => {
            const groupAlias = uniqueAlias('multisig-ci');
            const { roles, aliases, aids, memberAids } = await createMembers(
                'multisig-ci',
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
                throw new Error('Missing multisig CI canary member.');
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
                MULTISIG_ICP_ROUTE
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
                        route: MULTISIG_ICP_ROUTE,
                        status: 'unread',
                        message: 'Group invitation',
                        multisigRequest: expect.objectContaining({
                            exnSaid: notificationSaid(notification),
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
                        input: requestInput(notification, groupAlias, aliases[1]),
                    })
                ),
            ]);
            await expectGroupConvergence(roles, groupAlias);
            await assertMembershipAndThresholds(roles[0], groupAlias, memberAids, [
                '1/2',
                '1/2',
            ]);

            await authorizeGroupAgents({ roles, aliases, groupAlias });

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
        },
        360_000
    );
});
