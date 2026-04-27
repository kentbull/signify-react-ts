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
    TextField,
    Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { TelemetryRow } from '../../app/Console';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { MultisigGroupDetails } from '../../app/routeData';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { MultisigMemberOption } from '../../domain/multisig/multisigTypes';

/**
 * Multisig interaction dialog contract.
 *
 * The route supplies group details and submits the final interact command;
 * this dialog only chooses a local member and payload.
 */
interface MultisigInteractionDialogProps {
    group: IdentifierSummary | null;
    details: MultisigGroupDetails | null;
    memberOptions: readonly MultisigMemberOption[];
    actionRunning: boolean;
    onClose: () => void;
    onSubmit: (groupAlias: string, localMemberName: string, data: string) => void;
}

/**
 * Dialog for submitting an interaction event to an existing multisig group.
 */
export const MultisigInteractionDialog = ({
    group,
    details,
    memberOptions,
    actionRunning,
    onClose,
    onSubmit,
}: MultisigInteractionDialogProps) => {
    const localOptions = memberOptions.filter(
        (option) =>
            option.isLocal &&
            (details?.signingMemberAids.length === 0 ||
                details?.signingMemberAids.includes(option.aid) === true)
    );
    const [localMemberName, setLocalMemberName] = useState(
        localOptions[0]?.localName ?? ''
    );
    const [payload, setPayload] = useState('{}');
    const parsedPreview = (() => {
        try {
            return JSON.stringify(JSON.parse(payload), null, 2);
        } catch {
            return payload;
        }
    })();

    return (
        <Dialog open={group !== null} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Interact With Multisig Group</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TelemetryRow label="Group" value={group?.name ?? ''} />
                    <FormControl fullWidth>
                        <InputLabel id="interaction-local-member-label">
                            Local member
                        </InputLabel>
                        <Select
                            labelId="interaction-local-member-label"
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
                    <TextField
                        label="Interaction payload"
                        value={payload}
                        onChange={(event) => setPayload(event.target.value)}
                        multiline
                        minRows={4}
                        fullWidth
                    />
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: 'block',
                            fontFamily: 'var(--app-mono-font)',
                            letterSpacing: 0,
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {parsedPreview}
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    disabled={
                        actionRunning ||
                        group === null ||
                        localMemberName.trim().length === 0
                    }
                    onClick={() =>
                        group !== null &&
                        onSubmit(group.name, localMemberName.trim(), payload)
                    }
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                >
                    Interact
                </Button>
            </DialogActions>
        </Dialog>
    );
};
