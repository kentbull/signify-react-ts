import type { MouseEvent } from 'react';
import {
    Badge,
    Box,
    Button,
    CircularProgress,
    FormControl,
    IconButton,
    MenuItem,
    Select,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { StatusPill } from './Console';
import { UI_SOUND_HOVER_VALUE } from './uiSound';
import { abbreviateMiddle } from '../domain/contacts/contactHelpers';
import type { RegistryRecord } from '../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../domain/identifiers/identifierTypes';

/**
 * Shell toolbar state derived by `TopBar`.
 *
 * Keep runtime dispatch, route submission, and persistence in the container;
 * this component only renders controls and forwards user choices.
 */
interface TopBarToolbarProps {
    /** True when the shared Signify runtime has an active KERIA client. */
    isConnected: boolean;
    /** Current persisted hover-sound preference. */
    hoverSoundMuted: boolean;
    /** Wallet AID selected for credential-focused routes. */
    selectedIdentifier: IdentifierSummary | null;
    /** Credential registry selected for the current wallet AID. */
    selectedRegistry: RegistryRecord | null;
    identifiers: readonly IdentifierSummary[];
    readyRegistries: readonly RegistryRecord[];
    activeOperationCount: number;
    unreadNotificationCount: number;
    onMenuClick: () => void;
    onSelectedAidChange: (value: string) => void;
    onSelectedRegistryChange: (value: string) => void;
    onToggleHoverSoundMuted: () => void;
    onOpenOperations: (event: MouseEvent<HTMLElement>) => void;
    onOpenNotifications: (event: MouseEvent<HTMLElement>) => void;
    onConnectClick: () => void;
}

/**
 * Presentational top-bar toolbar for app navigation, wallet context, and shell indicators.
 */
export const TopBarToolbar = ({
    isConnected,
    hoverSoundMuted,
    selectedIdentifier,
    selectedRegistry,
    identifiers,
    readyRegistries,
    activeOperationCount,
    unreadNotificationCount,
    onMenuClick,
    onSelectedAidChange,
    onSelectedRegistryChange,
    onToggleHoverSoundMuted,
    onOpenOperations,
    onOpenNotifications,
    onConnectClick,
}: TopBarToolbarProps) => (
    <Toolbar
        sx={{
            display: 'flex',
            gap: { xs: 0.5, sm: 1.5 },
            minWidth: 0,
            minHeight: { xs: 56, sm: 64 },
        }}
    >
        <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            data-testid="nav-open"
            data-ui-sound={UI_SOUND_HOVER_VALUE}
            onClick={onMenuClick}
            sx={{ display: { xs: 'inline-flex', md: 'none' } }}
        >
            <MenuIcon />
        </IconButton>
        <Stack
            direction="row"
            spacing={1}
            sx={{
                flex: '1 1 auto',
                minWidth: 0,
                alignItems: 'center',
            }}
        >
            <Typography
                variant="h6"
                noWrap
                sx={{
                    flex: '0 0 auto',
                    color: 'text.primary',
                    fontWeight: 700,
                }}
            >
                Signify Ops
            </Typography>
            {selectedIdentifier !== null && (
                <FormControl
                    size="small"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        minWidth: { sm: 146, lg: 190 },
                        maxWidth: { sm: 170, lg: 230 },
                        flex: '0 1 auto',
                    }}
                >
                    <Select
                        aria-label="Selected wallet AID"
                        value={selectedIdentifier.prefix}
                        onChange={(event) =>
                            onSelectedAidChange(event.target.value)
                        }
                        renderValue={(value) => {
                            const identifier =
                                identifiers.find(
                                    (candidate) =>
                                        candidate.prefix === value
                                ) ?? selectedIdentifier;
                            return `${identifier.name} / ${abbreviateMiddle(
                                identifier.prefix,
                                12
                            )}`;
                        }}
                        data-testid="topbar-selected-aid"
                        sx={{
                            height: 32,
                            fontSize: '0.78rem',
                            bgcolor: 'rgba(13, 23, 34, 0.72)',
                            '.MuiSelect-select': {
                                py: 0.5,
                                pr: 3,
                                minWidth: 0,
                            },
                        }}
                    >
                        <MenuItem value="">
                            <em>Clear AID</em>
                        </MenuItem>
                        {identifiers.map((identifier) => (
                            <MenuItem
                                key={identifier.prefix}
                                value={identifier.prefix}
                            >
                                {identifier.name} /{' '}
                                {abbreviateMiddle(
                                    identifier.prefix,
                                    18
                                )}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}
            {selectedRegistry !== null && (
                <FormControl
                    size="small"
                    sx={{
                        display: { xs: 'none', lg: 'block' },
                        minWidth: 168,
                        maxWidth: 230,
                        flex: '0 1 auto',
                    }}
                >
                    <Select
                        aria-label="Selected credential registry"
                        value={selectedRegistry.id}
                        onChange={(event) =>
                            onSelectedRegistryChange(
                                event.target.value
                            )
                        }
                        renderValue={(value) => {
                            const registry =
                                readyRegistries.find(
                                    (candidate) =>
                                        candidate.id === value
                                ) ?? selectedRegistry;
                            return `Registry: ${registry.registryName}`;
                        }}
                        data-testid="topbar-selected-registry"
                        sx={{
                            height: 32,
                            fontSize: '0.78rem',
                            bgcolor: 'rgba(13, 23, 34, 0.72)',
                            '.MuiSelect-select': {
                                py: 0.5,
                                pr: 3,
                                minWidth: 0,
                            },
                        }}
                    >
                        <MenuItem value="">
                            <em>Clear registry</em>
                        </MenuItem>
                        {readyRegistries.map((registry) => (
                            <MenuItem
                                key={registry.id}
                                value={registry.id}
                            >
                                {registry.registryName} /{' '}
                                {abbreviateMiddle(registry.regk, 18)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}
        </Stack>
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
            <StatusPill
                label={isConnected ? 'KERIA online' : 'KERIA offline'}
                tone={isConnected ? 'success' : 'error'}
            />
        </Box>
        <Tooltip
            title={
                hoverSoundMuted
                    ? 'Enable interface sounds'
                    : 'Mute interface sounds'
            }
        >
            <IconButton
                color="inherit"
                aria-label={
                    hoverSoundMuted
                        ? 'Enable interface sounds'
                        : 'Mute interface sounds'
                }
                aria-pressed={hoverSoundMuted}
                data-testid="ui-sound-toggle"
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                onClick={onToggleHoverSoundMuted}
            >
                {hoverSoundMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
        </Tooltip>
        <Tooltip title="Background operations">
            <IconButton
                color="inherit"
                aria-label="Background operations"
                data-testid="operations-indicator"
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                onClick={onOpenOperations}
            >
                <Badge
                    color="primary"
                    badgeContent={activeOperationCount}
                    invisible={activeOperationCount === 0}
                >
                    {activeOperationCount > 0 ? (
                        <CircularProgress
                            size={22}
                            color="inherit"
                            aria-hidden="true"
                        />
                    ) : (
                        <Box
                            component="span"
                            sx={{
                                width: 22,
                                height: 22,
                                borderRadius: 1,
                                border: 2,
                                borderColor: 'currentColor',
                                display: 'block',
                            }}
                        />
                    )}
                </Badge>
            </IconButton>
        </Tooltip>
        <Tooltip title="Notifications">
            <IconButton
                color="inherit"
                aria-label="Notifications"
                data-testid="notifications-open"
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                onClick={onOpenNotifications}
            >
                <Badge
                    color="error"
                    badgeContent={unreadNotificationCount}
                    invisible={unreadNotificationCount === 0}
                >
                    <NotificationsIcon />
                </Badge>
            </IconButton>
        </Tooltip>
        <Button
            variant={isConnected ? 'outlined' : 'contained'}
            color={isConnected ? 'success' : 'primary'}
            aria-label={isConnected ? 'Connected' : 'Connect'}
            sx={{
                flex: '0 0 auto',
                minWidth: { xs: 44, sm: 92 },
                px: { xs: 1, sm: 2 },
                gap: 0.75,
                borderColor: isConnected ? 'success.main' : undefined,
            }}
            onClick={onConnectClick}
            data-testid="connect-open"
            data-ui-sound={UI_SOUND_HOVER_VALUE}
        >
            <CircleIcon
                sx={{
                    fontSize: 14,
                    color: isConnected ? 'success.main' : 'error.main',
                }}
            />
            <Typography
                component="span"
                sx={{ display: { xs: 'none', sm: 'inline' } }}
            >
                {isConnected ? 'Online' : 'Connect'}
            </Typography>
        </Button>
    </Toolbar>
);
