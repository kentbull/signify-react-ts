import type { ReactNode } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { StatusPill } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import { abbreviateMiddle } from '../../domain/contacts/contactHelpers';
import type {
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import type { AidAliases } from './dashboardViewModels';
import { credentialTypeLabel } from './dashboardDisplay';

/**
 * Fire-and-forget dashboard copy helper for inspectable identifiers.
 */
const copyToClipboard = (value: string): void => {
    void globalThis.navigator.clipboard?.writeText(value);
};

/**
 * Copyable abbreviated mono value for dashboard table and mobile rows.
 */
export const CopyableAbbreviation = ({
    value,
    label,
    maxLength = 18,
}: {
    value: string;
    label: string;
    maxLength?: number;
}) => (
    <Tooltip title={value}>
        <Box
            component="button"
            type="button"
            aria-label={`Copy ${label} ${value}`}
            data-ui-sound={UI_SOUND_HOVER_VALUE}
            onClick={(event) => {
                event.stopPropagation();
                copyToClipboard(value);
            }}
            sx={{
                p: 0,
                m: 0,
                border: 0,
                bgcolor: 'transparent',
                color: 'primary.main',
                cursor: 'copy',
                display: 'inline',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                textAlign: 'left',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'clip',
                verticalAlign: 'baseline',
                whiteSpace: 'nowrap',
                ...monoValueSx,
            }}
        >
            {abbreviateMiddle(value, maxLength)}
        </Box>
    </Tooltip>
);

/**
 * Render an AID with a known contact or local identifier alias when available.
 */
export const AidValue = ({
    aid,
    aliases,
}: {
    aid: string | null;
    aliases: AidAliases;
}) => {
    if (aid === null) {
        return <DetailValue mono>Not available</DetailValue>;
    }

    const alias = aliases.get(aid) ?? null;
    return (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            {alias !== null && (
                <Typography variant="body2" noWrap>
                    {alias}
                </Typography>
            )}
            <CopyableAbbreviation value={aid} label="AID" maxLength={20} />
        </Stack>
    );
};

/**
 * Full mono value for detail screens where truncation would hide evidence.
 */
export const FullMonoValue = ({ value }: { value: string }) => (
    <Typography component="span" variant="body2" sx={monoValueSx}>
        {value}
    </Typography>
);

/**
 * Render a full AID with its alias for credential detail views.
 */
export const FullAidValue = ({
    aid,
    aliases,
}: {
    aid: string | null;
    aliases: AidAliases;
}) => {
    if (aid === null) {
        return <FullMonoValue value="Not available" />;
    }

    const alias = aliases.get(aid) ?? null;
    return (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            {alias !== null && (
                <Typography variant="body2" noWrap>
                    {alias}
                </Typography>
            )}
            <FullMonoValue value={aid} />
        </Stack>
    );
};

/**
 * Render the dashboard credential type label and schema SAID affordance.
 */
export const CredentialTypeValue = ({
    credential,
    schemasBySaid = new Map(),
}: {
    credential: CredentialSummaryRecord;
    schemasBySaid?: ReadonlyMap<string, SchemaRecord>;
}) => (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap>
            {credentialTypeLabel(
                credential,
                credential.schemaSaid === null
                    ? null
                    : (schemasBySaid.get(credential.schemaSaid) ?? null)
            )}
        </Typography>
        {credential.schemaSaid !== null && (
            <CopyableAbbreviation
                value={credential.schemaSaid}
                label="schema SAID"
                maxLength={18}
            />
        )}
    </Stack>
);

/**
 * Typed dashboard detail value wrapper for table/mobile parity.
 */
export const DetailValue = ({
    children,
    mono = false,
}: {
    children: ReactNode;
    mono?: boolean;
}) => (
    <Typography
        component="span"
        variant="body2"
        sx={mono ? monoValueSx : undefined}
    >
        {children}
    </Typography>
);

/**
 * Stable navigation action back to the dashboard overview.
 */
export const BackToDashboard = () => (
    <Button
        component={RouterLink}
        to="/dashboard"
        variant="outlined"
        data-ui-sound={UI_SOUND_HOVER_VALUE}
    >
        Back to Dashboard
    </Button>
);

/**
 * Shared dashboard loader warning block.
 */
export const DashboardWarning = ({ message }: { message: string }) => (
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
        <Typography component="span" color="text.primary">
            {message}
        </Typography>
    </Box>
);
