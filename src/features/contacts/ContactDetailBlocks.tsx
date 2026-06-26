import {
    Box,
    Divider,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { StatusPill, TelemetryRow } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { formatTimestamp } from '../../app/timeFormat';
import type { ContactActionData } from '../../app/routeData';
import type { ChallengeRecord } from '../../state/challenges.slice';
import type { ContactOobiGroup } from '../../domain/contacts/contactHelpers';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

/**
 * Fire-and-forget contact detail copy helper.
 *
 * Contact workflows must not depend on clipboard success; failed writes are
 * treated as non-blocking browser affordance failures.
 */
const copyText = (value: string): void => {
    void globalThis.navigator?.clipboard?.writeText(value);
};

/**
 * Render contact route action feedback with the contact feature's accepted/error tones.
 */
export const ActionNotice = ({ data }: { data: ContactActionData }) => (
    <Box
        sx={{
            border: 1,
            borderColor: data.ok ? 'divider' : 'error.main',
            borderRadius: 1,
            bgcolor: (theme) =>
                alpha(
                    data.ok
                        ? theme.palette.primary.main
                        : theme.palette.error.main,
                    data.ok ? 0.06 : 0.08
                ),
            px: 2,
            py: 1.25,
        }}
    >
        <StatusPill
            label={data.ok ? 'accepted' : 'error'}
            tone={data.ok ? 'success' : 'error'}
        />{' '}
        <Typography component="span">{data.message}</Typography>
    </Box>
);

/**
 * Display a copyable contact detail value without owning the source data.
 */
export const CopyBlock = ({
    label,
    value,
    valueTestId,
}: {
    label: string;
    value: string;
    valueTestId?: string;
}) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 1,
            alignItems: 'start',
            minWidth: 0,
        }}
    >
        <Box sx={{ minWidth: 0 }}>
            <Typography
                variant="caption"
                color="primary.main"
                sx={{
                    display: 'block',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                }}
            >
                {label}
            </Typography>
            <Typography
                variant="body2"
                sx={monoValueSx}
                data-testid={valueTestId}
            >
                {value}
            </Typography>
        </Box>
        <Tooltip title={`Copy ${label}`}>
            <IconButton
                size="small"
                aria-label={`copy ${label}`}
                onClick={() => {
                    copyText(value);
                }}
            >
                <ContentCopyIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    </Box>
);

/**
 * Render grouped contact OOBIs while preserving their KERIA role labels.
 */
export const FullOobiBlock = ({
    groups,
}: {
    groups: readonly ContactOobiGroup[];
}) => (
    <Box sx={{ display: 'grid', gap: 1 }}>
        <Typography
            variant="caption"
            color="primary.main"
            sx={{
                display: 'block',
                fontWeight: 700,
                textTransform: 'uppercase',
            }}
        >
            Full OOBI
        </Typography>
        <Stack spacing={1.25}>
            {groups.map((group) => (
                <Box
                    key={group.role}
                    sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        px: 1.25,
                        py: 1,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: 'block',
                            fontWeight: 700,
                            mb: 0.75,
                            textTransform: 'uppercase',
                        }}
                    >
                        {group.label}
                    </Typography>
                    <Stack spacing={1}>
                        {group.oobis.map((oobi) => (
                            <CopyBlock
                                key={`${group.role}:${oobi}`}
                                label="OOBI URL"
                                value={oobi}
                            />
                        ))}
                    </Stack>
                </Box>
            ))}
        </Stack>
    </Box>
);

/**
 * Summarize one persisted challenge record for the contact detail route.
 */
export const ChallengeBlock = ({
    challenge,
}: {
    challenge: ChallengeRecord;
}) => (
    <Box
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            px: 1.25,
            py: 1,
        }}
    >
        <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
            <StatusPill
                label={challenge.status}
                tone={challenge.authenticated ? 'success' : 'warning'}
            />
            <Typography variant="caption" color="text.secondary">
                {timestampText(challenge.updatedAt)}
            </Typography>
        </Stack>
        <Divider sx={{ my: 1 }} />
        <TelemetryRow label="Words" value={`${challenge.words.length} words`} />
        <TelemetryRow
            label="Result"
            value={challenge.result ?? 'Not available'}
            mono
        />
    </Box>
);
