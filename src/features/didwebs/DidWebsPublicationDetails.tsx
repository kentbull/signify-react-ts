import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { StatusPill } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { didWebsAssetUrlsFromDid } from '../../domain/didwebs/didWebsUrls';
import type { DidWebsDidRecord } from '../../state/didwebs.slice';

const PENDING_VALUE = '...pending...';

const copyText = (value: string): void => {
    void globalThis.navigator?.clipboard?.writeText(value);
};

const displayState = (record: DidWebsDidRecord | null): string => {
    if (record?.did !== null && record?.did !== undefined) {
        return 'ready';
    }
    if (record?.loadState === 'loading') {
        return 'loading';
    }
    if (record?.loadState === 'error') {
        return 'error';
    }
    return 'pending';
};

const statusTone = (
    record: DidWebsDidRecord | null
): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
    if (record?.did !== null && record?.did !== undefined) {
        return 'success';
    }
    if (record?.loadState === 'error') {
        return 'error';
    }
    if (record?.loadState === 'loading') {
        return 'warning';
    }
    return 'info';
};

const readyValue = (value: string | null | undefined): string =>
    value ?? PENDING_VALUE;

const DetailRow = ({
    label,
    value,
    copyable,
    testId,
}: {
    label: string;
    value: string;
    copyable: boolean;
    testId?: string;
}) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: copyable ? 'minmax(0, 1fr) auto' : '1fr',
            gap: 1,
            alignItems: 'start',
            minWidth: 0,
        }}
    >
        <Box sx={{ minWidth: 0 }}>
            <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', fontWeight: 700 }}
            >
                {label}
            </Typography>
            <Typography
                variant="body2"
                data-testid={testId}
                sx={{
                    ...monoValueSx,
                    color: value === PENDING_VALUE ? 'text.secondary' : 'text.primary',
                }}
            >
                {value}
            </Typography>
        </Box>
        {copyable && (
            <Tooltip title={`Copy ${label}`}>
                <IconButton
                    size="small"
                    aria-label={`copy ${label}`}
                    onClick={() => copyText(value)}
                >
                    <ContentCopyIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        )}
    </Box>
);

export interface DidWebsPublicationDetailsProps {
    record: DidWebsDidRecord | null;
    testIdPrefix: string;
}

/** Render copyable did:webs material once a DID is available. */
export const DidWebsPublicationDetails = ({
    record,
    testIdPrefix,
}: DidWebsPublicationDetailsProps) => {
    const did = record?.did ?? null;
    const urls = did === null ? null : didWebsAssetUrlsFromDid(did);

    return (
        <Stack spacing={1.25} data-testid={`${testIdPrefix}-didwebs`}>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
                    gap: { xs: 0.5, sm: 1.5 },
                    alignItems: 'center',
                    minWidth: 0,
                }}
            >
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 700 }}
                >
                    Status
                </Typography>
                <StatusPill label={displayState(record)} tone={statusTone(record)} />
            </Box>
            <DetailRow
                label="did:webs DID"
                value={readyValue(did)}
                copyable={did !== null}
                testId={`${testIdPrefix}-didwebs-did`}
            />
            <DetailRow
                label="did.json URL"
                value={readyValue(urls?.didJsonUrl)}
                copyable={urls !== null}
                testId={`${testIdPrefix}-didwebs-did-json-url`}
            />
            <DetailRow
                label="keri.cesr URL"
                value={readyValue(urls?.keriCesrUrl)}
                copyable={urls !== null}
                testId={`${testIdPrefix}-didwebs-keri-cesr-url`}
            />
            {record?.loadState === 'error' && record.error !== null && (
                <Typography color="error" variant="body2">
                    {record.error}
                </Typography>
            )}
        </Stack>
    );
};
