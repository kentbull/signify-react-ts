import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    Link as RouterLink,
    useFetcher,
    useLoaderData,
    useNavigate,
    useParams,
} from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import {
    EmptyState,
    PageHeader,
    StatusPill,
} from '../../app/Console';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type {
    ContactActionData,
    CredentialActionData,
    MultisigActionData,
    NotificationsLoaderData,
} from '../../app/routeData';
import { useAppSelector } from '../../state/hooks';
import {
    selectChallengeRequestNotificationById,
    selectCredentialGrantNotificationById,
    selectDelegationRequestNotificationById,
    selectIdentifiers,
    selectKeriaNotificationById,
    selectMultisigRequestNotificationById,
} from '../../state/selectors';
import {
    defaultMultisigRequestGroupAlias,
    defaultMultisigRequestLocalMember,
    displayMultisigRequestGroupAlias,
    multisigRequestIntent,
    requiresMultisigJoinLabel,
} from '../multisig/multisigRequestUi';
import { NotificationProtocolPanels } from './NotificationProtocolPanels';

/**
 * Route view for one KERIA protocol notification or synthetic challenge item.
 */
export const NotificationDetailView = () => {
    const loaderData = useLoaderData() as NotificationsLoaderData;
    const { notificationId = '' } = useParams();
    const navigate = useNavigate();
    const dismissFetcher = useFetcher<ContactActionData>();
    const credentialFetcher = useFetcher<CredentialActionData>();
    const delegationFetcher = useFetcher<ContactActionData>();
    const multisigFetcher = useFetcher<MultisigActionData>();
    const [multisigAliasDrafts, setMultisigAliasDrafts] = useState<
        Record<string, string>
    >({});
    const notification = useAppSelector(
        selectKeriaNotificationById(notificationId)
    );
    const challengeRequest = useAppSelector(
        selectChallengeRequestNotificationById(notificationId)
    );
    const credentialGrant = useAppSelector(
        selectCredentialGrantNotificationById(notificationId)
    );
    const delegationRequest = useAppSelector(
        selectDelegationRequestNotificationById(notificationId)
    );
    const multisigRequest = useAppSelector(
        selectMultisigRequestNotificationById(notificationId)
    );
    const identifiers = useAppSelector(selectIdentifiers);
    const grantRecipient =
        credentialGrant === null
            ? undefined
            : identifiers.find(
                  (identifier) =>
                      identifier.prefix === credentialGrant.holderAid
              );
    const canAdmitGrant =
        credentialGrant?.status === 'actionable' &&
        grantRecipient !== undefined &&
        credentialFetcher.state === 'idle';
    const delegationApprover =
        delegationRequest === null
            ? undefined
            : identifiers.find(
                  (identifier) =>
                      identifier.prefix === delegationRequest.delegatorAid
              );
    const canApproveDelegation =
        delegationRequest?.status === 'actionable' &&
        delegationApprover !== undefined &&
        delegationFetcher.state === 'idle';
    const multisigMember =
        multisigRequest === null
            ? undefined
            : (defaultMultisigRequestLocalMember(
                  multisigRequest,
                  identifiers
              ) ?? undefined);
    const multisigDefaultGroupAlias =
        multisigRequest === null
            ? ''
            : defaultMultisigRequestGroupAlias(multisigRequest, identifiers);
    const multisigGroupAlias =
        multisigRequest === null
            ? ''
            : (multisigAliasDrafts[multisigRequest.notificationId] ??
              multisigDefaultGroupAlias);
    const multisigDisplayGroupAlias =
        multisigRequest === null
            ? 'Not available'
            : displayMultisigRequestGroupAlias(multisigRequest, identifiers);
    const multisigRequiresJoinLabel =
        multisigRequest !== null && requiresMultisigJoinLabel(multisigRequest);
    const canApproveMultisig =
        multisigRequest?.status === 'actionable' &&
        multisigMember !== undefined &&
        multisigGroupAlias.trim().length > 0 &&
        multisigFetcher.state === 'idle';

    useEffect(() => {
        if (
            dismissFetcher.data?.ok === true &&
            dismissFetcher.data.intent === 'dismissExchangeNotification'
        ) {
            navigate('/notifications');
        }
    }, [dismissFetcher.data, navigate]);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    if (notification === null) {
        return (
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <PageHeader
                    eyebrow="Notification"
                    title="Notification not found"
                    actions={
                        <Button
                            component={RouterLink}
                            to="/notifications"
                            startIcon={<ArrowBackIcon />}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Back to notifications
                        </Button>
                    }
                />
                <EmptyState
                    title="No notification record"
                    message="The notification may have been marked read, deleted, or not synced into this session yet."
                />
            </Box>
        );
    }

    const admitCredentialGrant = () => {
        if (credentialGrant === null || grantRecipient === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'admitCredentialGrant');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('holderAlias', grantRecipient.name);
        formData.set('holderAid', credentialGrant.holderAid);
        formData.set('notificationId', credentialGrant.notificationId);
        formData.set('grantSaid', credentialGrant.grantSaid);
        credentialFetcher.submit(formData, {
            method: 'post',
            action: '/credentials',
        });
    };

    const approveDelegationRequest = () => {
        if (delegationRequest === null || delegationApprover === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'approveDelegationRequest');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', delegationRequest.notificationId);
        formData.set('delegatorName', delegationApprover.name);
        formData.set('delegatorAid', delegationRequest.delegatorAid);
        formData.set('delegateAid', delegationRequest.delegateAid);
        formData.set('delegateEventSaid', delegationRequest.delegateEventSaid);
        formData.set('sequence', delegationRequest.sequence);
        formData.set('sourceAid', delegationRequest.sourceAid ?? '');
        formData.set('createdAt', delegationRequest.createdAt);
        delegationFetcher.submit(formData, {
            method: 'post',
            action: `/notifications/${encodeURIComponent(notification.id)}`,
        });
    };

    const approveMultisigRequest = () => {
        if (multisigRequest === null || multisigMember === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', multisigRequestIntent(multisigRequest));
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', multisigRequest.notificationId);
        formData.set('exnSaid', multisigRequest.exnSaid);
        formData.set('groupAlias', multisigGroupAlias.trim());
        formData.set('localMemberName', multisigMember.name);
        multisigFetcher.submit(formData, {
            method: 'post',
            action: '/multisig',
        });
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Notification"
                title={
                    challengeRequest !== null
                        ? 'Challenge request'
                        : credentialGrant !== null
                          ? 'Credential grant'
                          : delegationRequest !== null
                            ? 'Delegation request'
                            : multisigRequest !== null
                              ? 'Multisig request'
                            : notification.route
                }
                summary={notification.id}
                actions={
                    <Stack direction="row" spacing={1}>
                        {challengeRequest !== null && (
                            <Tooltip title="Dismiss challenge request">
                                <span>
                                    <IconButton
                                        color="error"
                                        aria-label="dismiss challenge request"
                                        data-testid="challenge-notification-detail-dismiss"
                                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                                        disabled={
                                            dismissFetcher.state !== 'idle'
                                        }
                                        onClick={() => {
                                            const formData = new FormData();
                                            formData.set(
                                                'intent',
                                                'dismissExchangeNotification'
                                            );
                                            formData.set(
                                                'requestId',
                                                globalThis.crypto.randomUUID()
                                            );
                                            formData.set(
                                                'notificationId',
                                                notification.id
                                            );
                                            formData.set(
                                                'exnSaid',
                                                challengeRequest.exnSaid
                                            );
                                            formData.set(
                                                'route',
                                                notification.route
                                            );
                                            dismissFetcher.submit(formData, {
                                                method: 'post',
                                                action: `/notifications/${encodeURIComponent(
                                                    notification.id
                                                )}`,
                                            });
                                        }}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        <Button
                            component={RouterLink}
                            to="/notifications"
                            startIcon={<ArrowBackIcon />}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Back to notifications
                        </Button>
                    </Stack>
                }
            />
            {loaderData.status === 'error' && (
                <Box
                    sx={{
                        border: 1,
                        borderColor: 'warning.main',
                        borderRadius: 1,
                        bgcolor: 'rgba(255, 196, 87, 0.08)',
                        px: 2,
                        py: 1.25,
                    }}
                >
                    <StatusPill label="warning" tone="warning" />{' '}
                    <Typography component="span">
                        {loaderData.message}
                    </Typography>
                </Box>
            )}
            <NotificationProtocolPanels
                notification={notification}
                challengeRequest={challengeRequest}
                credentialGrant={credentialGrant}
                delegationRequest={delegationRequest}
                multisigRequest={multisigRequest}
                identifiers={identifiers}
                grantRecipient={grantRecipient}
                canAdmitGrant={canAdmitGrant}
                delegationApprover={delegationApprover}
                canApproveDelegation={canApproveDelegation}
                multisigMember={multisigMember}
                multisigDisplayGroupAlias={multisigDisplayGroupAlias}
                multisigRequiresJoinLabel={multisigRequiresJoinLabel}
                multisigGroupAlias={multisigGroupAlias}
                canApproveMultisig={canApproveMultisig}
                setMultisigAliasDrafts={setMultisigAliasDrafts}
                admitCredentialGrant={admitCredentialGrant}
                approveDelegationRequest={approveDelegationRequest}
                approveMultisigRequest={approveMultisigRequest}
            />
        </Box>
    );
};
