import { useState } from 'react';
import {
    Box,
    Button,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HubIcon from '@mui/icons-material/Hub';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import SendIcon from '@mui/icons-material/Send';
import { useFetcher, useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import type {
    MultisigActionData,
    MultisigLoaderData,
} from '../../app/routeData';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import { useAppSelector } from '../../state/hooks';
import {
    selectContacts,
    selectIdentifiers,
    selectMultisigGroupIdentifiers,
    selectMultisigRequestNotifications,
} from '../../state/selectors';
import { truncateMiddle } from '../../domain/identifiers/identifierHelpers';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import { sithSummary } from '../../domain/multisig/multisigThresholds';
import type { MultisigCreateDraft } from '../../domain/multisig/multisigTypes';
import type { MultisigRequestNotification } from '../../state/notifications.slice';
import {
    defaultMultisigRequestGroupAlias,
    defaultMultisigRequestLocalMember,
    displayMultisigRequestGroupAlias,
    multisigRequestActionLabel,
    multisigRequestIntent,
    multisigRequestLocalMembers,
    multisigRequestTitle,
    requiresMultisigJoinLabel,
} from './multisigRequestUi';
import { MultisigCreateDialog } from './MultisigCreateDialog';
import { MultisigInteractionDialog } from './MultisigInteractionDialog';
import { MultisigRotationDialog } from './MultisigRotationDialog';
import {
    groupStateValue,
    isGroupIdentifier,
    memberOptionsFromInventory,
} from './multisigMemberOptions';

export const MultisigView = () => {
    const loaderData = useLoaderData() as MultisigLoaderData;
    const fetcher = useFetcher<MultisigActionData>();
    const liveIdentifiers = useAppSelector(selectIdentifiers);
    const contacts = useAppSelector(selectContacts);
    const groupIdentifiers = useAppSelector(selectMultisigGroupIdentifiers);
    const requests = useAppSelector(selectMultisigRequestNotifications);
    const [createOpen, setCreateOpen] = useState(false);
    const [interactionGroup, setInteractionGroup] =
        useState<IdentifierSummary | null>(null);
    const [rotationGroup, setRotationGroup] =
        useState<IdentifierSummary | null>(null);
    const [requestDrafts, setRequestDrafts] = useState<
        Record<string, { groupAlias: string; localMemberName: string }>
    >({});
    const actionRunning = fetcher.state !== 'idle';

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const identifiers =
        liveIdentifiers.length > 0 ? liveIdentifiers : loaderData.identifiers;
    const groups =
        groupIdentifiers.length > 0
            ? groupIdentifiers
            : identifiers.filter(isGroupIdentifier);
    const groupDetails = new Map(
        (loaderData.status === 'ready' || loaderData.status === 'error'
            ? loaderData.groupDetails
            : []
        ).map((detail) => [detail.groupAid, detail])
    );
    const memberOptions = memberOptionsFromInventory(identifiers, contacts);
    const localMemberIdentifiers = multisigRequestLocalMembers(identifiers);

    const submitDraft = (intent: string, fields: Record<string, string>) => {
        const formData = new FormData();
        formData.set('intent', intent);
        formData.set('requestId', globalThis.crypto.randomUUID());
        for (const [key, value] of Object.entries(fields)) {
            formData.set(key, value);
        }
        fetcher.submit(formData, { method: 'post' });
    };

    const createGroup = (draft: MultisigCreateDraft) => {
        submitDraft('create', { draft: JSON.stringify(draft) });
        setCreateOpen(false);
    };

    const submitRequest = (request: MultisigRequestNotification) => {
        const defaults = {
            groupAlias: defaultMultisigRequestGroupAlias(request, identifiers),
            localMemberName:
                defaultMultisigRequestLocalMember(request, identifiers)?.name ??
                '',
        };
        const draft = requestDrafts[request.notificationId] ?? defaults;
        submitDraft(multisigRequestIntent(request), {
            notificationId: request.notificationId,
            exnSaid: request.exnSaid,
            groupAlias: draft.groupAlias.trim(),
            localMemberName: draft.localMemberName,
        });
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Group identity"
                title="Multisig"
                summary="Create group AIDs, approve group protocol requests, authorize member agents, interact, and rotate."
                actions={
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateOpen(true)}
                        disabled={actionRunning}
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        New group
                    </Button>
                }
            />
            {loaderData.status === 'error' && (
                <Box
                    sx={{
                        border: 1,
                        borderColor: 'warning.main',
                        borderRadius: 1,
                        bgcolor: (theme) =>
                            alpha(theme.palette.warning.main, 0.08),
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
            {fetcher.data !== undefined &&
                (() => {
                    const actionData = fetcher.data;

                    return (
                        <Box
                            sx={{
                                border: 1,
                                borderColor: actionData.ok
                                    ? 'divider'
                                    : 'error.main',
                                borderRadius: 1,
                                bgcolor: (theme) =>
                                    alpha(
                                        actionData.ok
                                            ? theme.palette.primary.main
                                            : theme.palette.error.main,
                                        actionData.ok ? 0.06 : 0.08
                                    ),
                                px: 2,
                                py: 1.25,
                            }}
                        >
                            <StatusPill
                                label={actionData.ok ? 'accepted' : 'error'}
                                tone={actionData.ok ? 'info' : 'error'}
                            />{' '}
                            <Typography component="span">
                                {actionData.message}
                            </Typography>
                        </Box>
                    );
                })()}
            <ConsolePanel
                title="Groups"
                eyebrow="Managed"
                actions={<StatusPill label={`${groups.length}`} />}
            >
                {groups.length === 0 ? (
                    <EmptyState
                        title="No multisig groups"
                        message="Create a group after resolving member OOBIs into contacts."
                    />
                ) : (
                    <Stack spacing={2}>
                        {groups.map((group) => {
                            const details =
                                groupDetails.get(group.prefix) ?? null;
                            const sequence = groupStateValue(group, 's');
                            const digest = groupStateValue(group, 'd');
                            return (
                                <Box
                                    key={group.prefix}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1.5,
                                    }}
                                >
                                    <Stack spacing={1.25}>
                                        <Stack
                                            direction={{
                                                xs: 'column',
                                                sm: 'row',
                                            }}
                                            sx={{
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="h6">
                                                    {group.name}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        fontFamily:
                                                            'var(--app-mono-font)',
                                                        letterSpacing: 0,
                                                    }}
                                                >
                                                    {truncateMiddle(
                                                        group.prefix,
                                                        12
                                                    )}
                                                </Typography>
                                            </Box>
                                            <Stack
                                                direction="row"
                                                spacing={0.75}
                                                sx={{ flexWrap: 'wrap' }}
                                            >
                                                <StatusPill
                                                    label="group"
                                                    tone="info"
                                                />
                                                <StatusPill
                                                    label={
                                                        details === null
                                                            ? 'activation unknown'
                                                            : 'ready for actions'
                                                    }
                                                    tone={
                                                        details === null
                                                            ? 'warning'
                                                            : 'success'
                                                    }
                                                />
                                            </Stack>
                                        </Stack>
                                        <TelemetryRow
                                            label="Sequence"
                                            value={sequence ?? 'Unavailable'}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Digest"
                                            value={digest ?? 'Unavailable'}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Signing members"
                                            value={
                                                details?.signingMemberAids.length.toString() ??
                                                'Unavailable'
                                            }
                                        />
                                        <TelemetryRow
                                            label="Signing threshold"
                                            value={sithSummary(
                                                details?.signingThreshold ??
                                                    null
                                            )}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Rotation members"
                                            value={
                                                details?.rotationMemberAids.length.toString() ??
                                                'Unavailable'
                                            }
                                        />
                                        <TelemetryRow
                                            label="Next threshold"
                                            value={sithSummary(
                                                details?.rotationThreshold ??
                                                    null
                                            )}
                                            mono
                                        />
                                        <Divider />
                                        <Stack
                                            direction={{
                                                xs: 'column',
                                                md: 'row',
                                            }}
                                            spacing={1}
                                        >
                                            <Button
                                                variant="outlined"
                                                startIcon={<HubIcon />}
                                                disabled={actionRunning}
                                                onClick={() =>
                                                    submitDraft(
                                                        'authorizeAgents',
                                                        {
                                                            groupAlias:
                                                                group.name,
                                                        }
                                                    )
                                                }
                                                data-ui-sound={
                                                    UI_SOUND_HOVER_VALUE
                                                }
                                            >
                                                Authorize agents
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<SendIcon />}
                                                disabled={actionRunning}
                                                onClick={() =>
                                                    setInteractionGroup(group)
                                                }
                                                data-ui-sound={
                                                    UI_SOUND_HOVER_VALUE
                                                }
                                            >
                                                Interact
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<RotateRightIcon />}
                                                disabled={actionRunning}
                                                onClick={() =>
                                                    setRotationGroup(group)
                                                }
                                                data-ui-sound={
                                                    UI_SOUND_HOVER_VALUE
                                                }
                                            >
                                                Rotate
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </ConsolePanel>
            <ConsolePanel
                title="Multisig requests"
                eyebrow="Protocol inbox"
                actions={<StatusPill label={`${requests.length}`} />}
            >
                {requests.length === 0 ? (
                    <EmptyState
                        title="No multisig requests"
                        message="Incoming group inception, role, interaction, and rotation requests appear here after notification sync."
                    />
                ) : (
                    <Stack spacing={2}>
                        {requests.map((request) => {
                            const localDefault =
                                defaultMultisigRequestLocalMember(
                                    request,
                                    identifiers
                                );
                            const draft = requestDrafts[
                                request.notificationId
                            ] ?? {
                                groupAlias: defaultMultisigRequestGroupAlias(
                                    request,
                                    identifiers
                                ),
                                localMemberName: localDefault?.name ?? '',
                            };
                            const requiresJoinLabel =
                                requiresMultisigJoinLabel(request);
                            return (
                                <Box
                                    key={request.notificationId}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1.5,
                                    }}
                                >
                                    <Stack spacing={1.25}>
                                        <Stack
                                            direction={{
                                                xs: 'column',
                                                sm: 'row',
                                            }}
                                            sx={{
                                                alignItems: {
                                                    xs: 'stretch',
                                                    sm: 'center',
                                                },
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Typography variant="h6">
                                                {multisigRequestTitle(request)}
                                            </Typography>
                                            <StatusPill
                                                label={request.status}
                                                tone={
                                                    request.status ===
                                                    'actionable'
                                                        ? 'info'
                                                        : request.status ===
                                                            'error'
                                                          ? 'error'
                                                          : request.status ===
                                                              'notForThisWallet'
                                                            ? 'warning'
                                                            : 'success'
                                                }
                                            />
                                        </Stack>
                                        <TelemetryRow
                                            label="Group AID"
                                            value={
                                                request.groupAid ??
                                                'Not available'
                                            }
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Group alias"
                                            value={displayMultisigRequestGroupAlias(
                                                request,
                                                identifiers
                                            )}
                                        />
                                        <TelemetryRow
                                            label="Sender"
                                            value={
                                                request.senderAid ??
                                                'Not available'
                                            }
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Responses"
                                            value={`${request.progress.completed}/${request.progress.total}`}
                                        />
                                        <TelemetryRow
                                            label="Responded"
                                            value={
                                                request.progress.respondedMemberAids
                                                    .map((aid) =>
                                                        truncateMiddle(aid, 10)
                                                    )
                                                    .join(', ') || 'None'
                                            }
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Waiting"
                                            value={
                                                request.progress.waitingMemberAids
                                                    .map((aid) =>
                                                        truncateMiddle(aid, 10)
                                                    )
                                                    .join(', ') || 'None'
                                            }
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Signing members"
                                            value={
                                                request.signingMemberAids.length
                                            }
                                        />
                                        <TelemetryRow
                                            label="Signing threshold"
                                            value={sithSummary(
                                                request.signingThreshold
                                            )}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Rotation members"
                                            value={
                                                request.rotationMemberAids
                                                    .length
                                            }
                                        />
                                        <TelemetryRow
                                            label="Rotation threshold"
                                            value={sithSummary(
                                                request.rotationThreshold
                                            )}
                                            mono
                                        />
                                        {request.embeddedPayloadSummary !==
                                            null && (
                                            <TelemetryRow
                                                label="Payload"
                                                value={
                                                    request.embeddedPayloadSummary
                                                }
                                                mono
                                            />
                                        )}
                                        <Divider />
                                        <Stack
                                            direction={{
                                                xs: 'column',
                                                md: 'row',
                                            }}
                                            spacing={1}
                                        >
                                            <TextField
                                                size="small"
                                                label={
                                                    requiresJoinLabel
                                                        ? 'New group label'
                                                        : 'Group alias'
                                                }
                                                value={draft.groupAlias}
                                                helperText={
                                                    requiresJoinLabel
                                                        ? 'Local label for this wallet after joining.'
                                                        : undefined
                                                }
                                                onChange={(event) =>
                                                    setRequestDrafts(
                                                        (current) => ({
                                                            ...current,
                                                            [request.notificationId]:
                                                                {
                                                                    ...draft,
                                                                    groupAlias:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                },
                                                        })
                                                    )
                                                }
                                            />
                                            <FormControl
                                                size="small"
                                                sx={{ minWidth: 220 }}
                                            >
                                                <InputLabel
                                                    id={`request-member-${request.notificationId}`}
                                                >
                                                    Local member
                                                </InputLabel>
                                                <Select
                                                    labelId={`request-member-${request.notificationId}`}
                                                    label="Local member"
                                                    value={
                                                        draft.localMemberName
                                                    }
                                                    onChange={(event) =>
                                                        setRequestDrafts(
                                                            (current) => ({
                                                                ...current,
                                                                [request.notificationId]:
                                                                    {
                                                                        ...draft,
                                                                        localMemberName:
                                                                            event
                                                                                .target
                                                                                .value,
                                                                    },
                                                            })
                                                        )
                                                    }
                                                >
                                                    {localMemberIdentifiers.map(
                                                        (identifier) => (
                                                            <MenuItem
                                                                key={
                                                                    identifier.prefix
                                                                }
                                                                value={
                                                                    identifier.name
                                                                }
                                                            >
                                                                {
                                                                    identifier.name
                                                                }
                                                            </MenuItem>
                                                        )
                                                    )}
                                                </Select>
                                            </FormControl>
                                            <Button
                                                variant="contained"
                                                startIcon={<CheckCircleIcon />}
                                                disabled={
                                                    actionRunning ||
                                                    request.status !==
                                                        'actionable' ||
                                                    draft.groupAlias.trim()
                                                        .length === 0 ||
                                                    draft.localMemberName.trim()
                                                        .length === 0
                                                }
                                                onClick={() =>
                                                    submitRequest(request)
                                                }
                                                data-ui-sound={
                                                    UI_SOUND_HOVER_VALUE
                                                }
                                            >
                                                {multisigRequestActionLabel(
                                                    request
                                                )}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </ConsolePanel>
            {createOpen && (
                <MultisigCreateDialog
                    open={createOpen}
                    actionRunning={actionRunning}
                    identifiers={identifiers}
                    contacts={contacts}
                    onClose={() => setCreateOpen(false)}
                    onCreate={createGroup}
                />
            )}
            <MultisigInteractionDialog
                key={interactionGroup?.prefix ?? 'interaction'}
                group={interactionGroup}
                details={
                    interactionGroup === null
                        ? null
                        : (groupDetails.get(interactionGroup.prefix) ?? null)
                }
                memberOptions={memberOptions}
                actionRunning={actionRunning}
                onClose={() => setInteractionGroup(null)}
                onSubmit={(
                    groupAlias: string,
                    localMemberName: string,
                    data: string
                ) => {
                    submitDraft('interact', {
                        groupAlias,
                        localMemberName,
                        data,
                    });
                    setInteractionGroup(null);
                }}
            />
            <MultisigRotationDialog
                key={rotationGroup?.prefix ?? 'rotation'}
                group={rotationGroup}
                details={
                    rotationGroup === null
                        ? null
                        : (groupDetails.get(rotationGroup.prefix) ?? null)
                }
                memberOptions={memberOptions}
                actionRunning={actionRunning}
                onClose={() => setRotationGroup(null)}
                onSubmit={(draft: {
                    groupAlias: string;
                    localMemberName: string | null;
                    signingMemberAids: string[];
                    rotationMemberAids: string[];
                    nextThreshold: unknown;
                }) => {
                    submitDraft('rotate', { draft: JSON.stringify(draft) });
                    setRotationGroup(null);
                }}
            />
        </Box>
    );
};
