import { useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
} from '@mui/material';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import { TelemetryRow } from '../../app/Console';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { MultisigGroupDetails } from '../../app/routeData';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import {
    thresholdSpecForMembers,
    thresholdSpecFromSith,
    validateThresholdSpecForMembers,
    type MultisigThresholdSpec,
} from '../../domain/multisig/multisigThresholds';
import type { MultisigMemberOption } from '../../domain/multisig/multisigTypes';
import { ThresholdEditor } from './ThresholdEditor';

/**
 * Multisig rotation dialog contract.
 *
 * The parent route owns command submission and group refresh; this dialog
 * edits the next member set and threshold draft only.
 */
interface MultisigRotationDialogProps {
    group: IdentifierSummary | null;
    details: MultisigGroupDetails | null;
    memberOptions: readonly MultisigMemberOption[];
    actionRunning: boolean;
    onClose: () => void;
    onSubmit: (draft: {
        groupAlias: string;
        localMemberName: string | null;
        signingMemberAids: string[];
        rotationMemberAids: string[];
        nextThreshold: MultisigThresholdSpec;
    }) => void;
}

/**
 * Dialog for preparing a multisig rotation event from current group details.
 */
export const MultisigRotationDialog = ({
    group,
    details,
    memberOptions,
    actionRunning,
    onClose,
    onSubmit,
}: MultisigRotationDialogProps) => {
    const initialAids =
        details?.rotationMemberAids.length === 0
            ? (details?.signingMemberAids ?? [])
            : (details?.rotationMemberAids ?? []);
    const [rotationAids, setRotationAids] = useState(initialAids);
    const [nextThreshold, setNextThreshold] = useState<MultisigThresholdSpec>(
        details?.rotationThreshold === null || details?.rotationThreshold === undefined
            ? thresholdSpecForMembers(initialAids)
            : thresholdSpecFromSith(details.rotationThreshold, initialAids)
    );
    const localOptions = memberOptions.filter((option) => option.isLocal);
    const [localMemberName, setLocalMemberName] = useState(
        localOptions.find((option) =>
            details?.signingMemberAids.includes(option.aid)
        )?.localName ??
            localOptions[0]?.localName ??
            ''
    );
    const validation = validateThresholdSpecForMembers({
        spec: nextThreshold,
        memberAids: rotationAids,
    });

    return (
        <Dialog open={group !== null} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>Rotate Multisig Group</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TelemetryRow label="Group" value={group?.name ?? ''} />
                    <FormControl fullWidth>
                        <InputLabel id="rotation-local-member-label">
                            Local member
                        </InputLabel>
                        <Select
                            labelId="rotation-local-member-label"
                            label="Local member"
                            value={localMemberName}
                            onChange={(event) =>
                                setLocalMemberName(event.target.value)
                            }
                        >
                            {localOptions.map((option) => (
                                <MenuItem
                                    key={option.aid}
                                    value={option.localName ?? ''}
                                >
                                    {option.alias}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <ThresholdEditor
                        title="Next rotation threshold"
                        memberOptions={memberOptions}
                        selectedAids={rotationAids}
                        spec={nextThreshold}
                        disabled={actionRunning}
                        onSelectedAidsChange={setRotationAids}
                        onSpecChange={setNextThreshold}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    startIcon={<RotateRightIcon />}
                    disabled={
                        actionRunning ||
                        group === null ||
                        localMemberName.trim().length === 0 ||
                        validation !== null
                    }
                    onClick={() =>
                        group !== null &&
                        onSubmit({
                            groupAlias: group.name,
                            localMemberName: localMemberName.trim(),
                            signingMemberAids: details?.signingMemberAids ?? [],
                            rotationMemberAids: rotationAids,
                            nextThreshold,
                        })
                    }
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                >
                    Rotate
                </Button>
            </DialogActions>
        </Dialog>
    );
};
