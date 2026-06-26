import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import { StatusPill, TelemetryRow } from '../../app/Console';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { ContactRecord } from '../../state/contacts.slice';
import { truncateMiddle } from '../../domain/identifiers/identifierHelpers';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import {
    thresholdSpecForMembers,
    thresholdSummary,
    validateThresholdSpecForMembers,
    type MultisigThresholdSpec,
} from '../../domain/multisig/multisigThresholds';
import type { MultisigCreateDraft } from '../../domain/multisig/multisigTypes';
import { ThresholdEditor } from './ThresholdEditor';
import {
    isDeliverableMember,
    memberDeliveryLabel,
    memberDeliveryTone,
    memberDrafts,
    memberOptionsFromInventory,
    specForAids,
    unique,
} from './multisigMemberOptions';

/**
 * Multisig group creation dialog state owned by the dialog.
 *
 * The parent route owns fetcher submission; this component emits one
 * validated inception draft and never submits route actions directly.
 */
interface MultisigCreateDialogProps {
    open: boolean;
    actionRunning: boolean;
    identifiers: readonly IdentifierSummary[];
    contacts: readonly ContactRecord[];
    onClose: () => void;
    onCreate: (draft: MultisigCreateDraft) => void;
}

/**
 * Wizard-style multisig group inception form.
 */
export const MultisigCreateDialog = ({
    open,
    actionRunning,
    identifiers,
    contacts,
    onClose,
    onCreate,
}: MultisigCreateDialogProps) => {
    const options = useMemo(
        () => memberOptionsFromInventory(identifiers, contacts),
        [contacts, identifiers]
    );
    const localOptions = options.filter((option) => option.isLocal);
    const defaultLocal = localOptions[0];
    const [step, setStep] = useState(0);
    const [groupAlias, setGroupAlias] = useState('');
    const [localMemberAid, setLocalMemberAid] = useState(defaultLocal?.aid ?? '');
    const [candidateAids, setCandidateAids] = useState<string[]>(
        defaultLocal === undefined ? [] : [defaultLocal.aid]
    );
    const [signingAids, setSigningAids] = useState<string[]>(
        defaultLocal === undefined ? [] : [defaultLocal.aid]
    );
    const [rotationAids, setRotationAids] = useState<string[]>(
        defaultLocal === undefined ? [] : [defaultLocal.aid]
    );
    const [signingThreshold, setSigningThreshold] = useState<MultisigThresholdSpec>(
        thresholdSpecForMembers(signingAids)
    );
    const [rotationThreshold, setRotationThreshold] = useState<MultisigThresholdSpec>(
        thresholdSpecForMembers(rotationAids)
    );
    const [rotationLinked, setRotationLinked] = useState(true);
    const [memberSearch, setMemberSearch] = useState('');
    const [useDemoWitnesses, setUseDemoWitnesses] = useState(false);
    const localMember = localOptions.find((option) => option.aid === localMemberAid);
    const thresholdOptions = options.filter((option) =>
        candidateAids.includes(option.aid)
    );
    const signingError = validateThresholdSpecForMembers({
        spec: signingThreshold,
        memberAids: signingAids,
    });
    const rotationError = validateThresholdSpecForMembers({
        spec: rotationThreshold,
        memberAids: rotationAids,
    });
    const undeliverableMembers = unique([...signingAids, ...rotationAids]).flatMap(
        (aid) => {
            const option = options.find((candidate) => candidate.aid === aid);
            return option !== undefined && !isDeliverableMember(option)
                ? [option]
                : [];
        }
    );
    const deliveryError =
        undeliverableMembers.length === 0
            ? null
            : `Resolve member agent OOBIs before creating the group: ${undeliverableMembers
                  .map((member) => member.alias)
                  .join(', ')}`;
    const createDisabled =
        actionRunning ||
        groupAlias.trim().length === 0 ||
        localMember?.localName === undefined ||
        signingAids.length === 0 ||
        rotationAids.length === 0 ||
        !signingAids.includes(localMemberAid) ||
        signingError !== null ||
        rotationError !== null ||
        deliveryError !== null;
    const visibleOptions = options.filter((option) => {
        const haystack = `${option.alias} ${option.aid}`.toLowerCase();
        return haystack.includes(memberSearch.trim().toLowerCase());
    });

    const setLocalMember = (aid: string) => {
        setLocalMemberAid(aid);
        setCandidateAids((current) => unique([aid, ...current]));
        setSigningAids((current) => {
            const next = unique([aid, ...current]);
            const nextSpec = specForAids(signingThreshold, next);
            setSigningThreshold(nextSpec);
            if (rotationLinked) {
                setRotationAids(next);
                setRotationThreshold(nextSpec);
            }
            return next;
        });
    };

    const toggleMember = (aid: string, checked: boolean) => {
        if (checked) {
            const nextCandidates = unique([...candidateAids, aid]);
            const nextSigning = unique([...signingAids, aid]);
            const nextSigningSpec = thresholdSpecForMembers(nextSigning);
            setCandidateAids(nextCandidates);
            setSigningAids(nextSigning);
            setSigningThreshold(nextSigningSpec);
            if (rotationLinked) {
                setRotationAids(nextSigning);
                setRotationThreshold(nextSigningSpec);
            } else {
                const nextRotation = unique([...rotationAids, aid]);
                setRotationAids(nextRotation);
                setRotationThreshold(thresholdSpecForMembers(nextRotation));
            }
            return;
        }

        if (aid === localMemberAid) {
            return;
        }

        const nextCandidates = candidateAids.filter((item) => item !== aid);
        const nextSigning = signingAids.filter((item) => item !== aid);
        const nextRotation = rotationAids.filter((item) => item !== aid);
        setCandidateAids(nextCandidates);
        setSigningAids(nextSigning);
        setSigningThreshold(thresholdSpecForMembers(nextSigning));
        setRotationAids(nextRotation);
        setRotationThreshold(thresholdSpecForMembers(nextRotation));
    };

    const setSigningSelection = (aids: string[]) => {
        setSigningAids(aids);
        if (rotationLinked) {
            setRotationAids(aids);
        }
    };

    const setSigningSpec = (spec: MultisigThresholdSpec) => {
        setSigningThreshold(spec);
        if (rotationLinked) {
            setRotationThreshold(spec);
        }
    };

    const submit = () => {
        if (localMember?.localName === undefined || createDisabled) {
            return;
        }
        const memberAids = unique([...signingAids, ...rotationAids]);
        onCreate({
            groupAlias: groupAlias.trim(),
            localMemberName: localMember.localName,
            localMemberAid,
            members: memberDrafts(memberAids, options),
            signingMemberAids: signingAids,
            rotationMemberAids: rotationAids,
            signingThreshold,
            rotationThreshold,
            witnessMode: useDemoWitnesses ? 'demo' : 'none',
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>Create Multisig Group</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Tabs value={step} onChange={(_, value: number) => setStep(value)}>
                        <Tab label="Basics" />
                        <Tab label="Members" />
                        <Tab label="Thresholds" />
                        <Tab label="Review" />
                    </Tabs>
                    {step === 0 && (
                        <Stack spacing={2}>
                            <TextField
                                label="Group alias"
                                value={groupAlias}
                                onChange={(event) =>
                                    setGroupAlias(event.target.value)
                                }
                                fullWidth
                            />
                            <FormControl fullWidth>
                                <InputLabel id="multisig-local-member-label">
                                    Local signing member
                                </InputLabel>
                                <Select
                                    labelId="multisig-local-member-label"
                                    label="Local signing member"
                                    value={localMemberAid}
                                    onChange={(event) =>
                                        setLocalMember(event.target.value)
                                    }
                                >
                                    {localOptions.map((option) => (
                                        <MenuItem key={option.aid} value={option.aid}>
                                            {option.alias}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={useDemoWitnesses}
                                        onChange={(event) =>
                                            setUseDemoWitnesses(event.target.checked)
                                        }
                                    />
                                }
                                label="Use demo witnesses"
                            />
                        </Stack>
                    )}
                    {step === 1 && (
                        <Stack spacing={1.5}>
                            <TextField
                                label="Search members"
                                value={memberSearch}
                                onChange={(event) =>
                                    setMemberSearch(event.target.value)
                                }
                                fullWidth
                            />
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: '1fr',
                                        md: 'repeat(2, minmax(0, 1fr))',
                                    },
                                    gap: 1,
                                }}
                            >
                                {visibleOptions.map((option) => (
                                    <Box
                                        key={option.aid}
                                        sx={{
                                            border: 1,
                                            borderColor: candidateAids.includes(
                                                option.aid
                                            )
                                                ? 'primary.main'
                                                : 'divider',
                                            borderRadius: 1,
                                            p: 1,
                                            bgcolor: 'background.paper',
                                        }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={candidateAids.includes(
                                                        option.aid
                                                    )}
                                                    disabled={
                                                        option.aid === localMemberAid
                                                    }
                                                    onChange={(event) =>
                                                        toggleMember(
                                                            option.aid,
                                                            event.target.checked
                                                        )
                                                    }
                                                />
                                            }
                                            label={
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Stack
                                                        direction="row"
                                                        spacing={0.75}
                                                        sx={{
                                                            alignItems: 'center',
                                                            flexWrap: 'wrap',
                                                        }}
                                                    >
                                                        <Typography variant="body2">
                                                            {option.alias}
                                                        </Typography>
                                                        <StatusPill
                                                            label={option.source}
                                                            tone="neutral"
                                                        />
                                                        <StatusPill
                                                            label={memberDeliveryLabel(
                                                                option.deliveryStatus
                                                            )}
                                                            tone={memberDeliveryTone(
                                                                option.deliveryStatus
                                                            )}
                                                        />
                                                    </Stack>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            fontFamily:
                                                                'var(--app-mono-font)',
                                                            letterSpacing: 0,
                                                            overflowWrap: 'anywhere',
                                                        }}
                                                    >
                                                        {truncateMiddle(option.aid)}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Stack>
                    )}
                    {step === 2 && (
                        <Stack spacing={2}>
                            <ThresholdEditor
                                title="Signing threshold"
                                memberOptions={thresholdOptions}
                                selectedAids={signingAids}
                                spec={signingThreshold}
                                disabled={actionRunning}
                                onSelectedAidsChange={setSigningSelection}
                                onSpecChange={setSigningSpec}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={rotationLinked}
                                        onChange={(event) => {
                                            setRotationLinked(event.target.checked);
                                            if (event.target.checked) {
                                                setRotationAids(signingAids);
                                                setRotationThreshold(signingThreshold);
                                            }
                                        }}
                                    />
                                }
                                label="Mirror rotation threshold from signing"
                            />
                            <ThresholdEditor
                                title="Rotation threshold"
                                memberOptions={thresholdOptions}
                                selectedAids={rotationAids}
                                spec={rotationThreshold}
                                disabled={actionRunning || rotationLinked}
                                onSelectedAidsChange={(aids) => {
                                    setRotationLinked(false);
                                    setRotationAids(aids);
                                }}
                                onSpecChange={(spec) => {
                                    setRotationLinked(false);
                                    setRotationThreshold(spec);
                                }}
                            />
                            {deliveryError !== null && (
                                <Typography variant="body2" color="warning.main">
                                    {deliveryError}
                                </Typography>
                            )}
                        </Stack>
                    )}
                    {step === 3 && (
                        <Stack spacing={1}>
                            <TelemetryRow label="Group alias" value={groupAlias} />
                            <TelemetryRow
                                label="Local member"
                                value={localMember?.alias ?? 'Not selected'}
                            />
                            <TelemetryRow
                                label="Signing members"
                                value={signingAids.length.toString()}
                            />
                            <TelemetryRow
                                label="Signing sith"
                                value={thresholdSummary(signingThreshold)}
                                mono
                            />
                            <TelemetryRow
                                label="Rotation members"
                                value={rotationAids.length.toString()}
                            />
                            <TelemetryRow
                                label="Rotation sith"
                                value={thresholdSummary(rotationThreshold)}
                                mono
                            />
                            <TelemetryRow
                                label="Witness mode"
                                value={useDemoWitnesses ? 'demo' : 'none'}
                            />
                            <TelemetryRow
                                label="Delivery"
                                value={
                                    deliveryError ?? 'All remote members are ready'
                                }
                            />
                        </Stack>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    disabled={step === 0}
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                >
                    Back
                </Button>
                {step < 3 ? (
                    <Button
                        variant="contained"
                        onClick={() => setStep((current) => Math.min(3, current + 1))}
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        startIcon={<GroupsIcon />}
                        disabled={createDisabled}
                        onClick={submit}
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        Create group
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};
