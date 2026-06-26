import { Box, List, ListItemButton, ListItemText, Popover, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { formatOperationWindow } from './timeFormat';
import { UI_SOUND_HOVER_VALUE } from './uiSound';
import type { OperationRecord } from '../state/operations.slice';

/**
 * Active-operation popover state owned by `TopBar`.
 *
 * The popover only displays operation links; operation lifecycle and polling
 * stay in the runtime and shell container.
 */
interface TopBarOperationsPopoverProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    activeOperations: readonly OperationRecord[];
    onClose: () => void;
}

/**
 * Render the background operation menu without owning operation state.
 */
export const TopBarOperationsPopover = ({
    open,
    anchorEl,
    activeOperations,
    onClose,
}: TopBarOperationsPopoverProps) => (
    <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => onClose()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
        <List sx={{ width: 340, maxWidth: '90vw', p: 1 }}>
            {activeOperations.length === 0 ? (
                <ListItemText
                    sx={{ px: 2, py: 1 }}
                    primary="No active operations"
                />
            ) : (
                activeOperations.map((operation) => (
                    <ListItemButton
                        key={operation.requestId}
                        component={RouterLink}
                        to={operation.operationRoute}
                        onClick={() => onClose()}
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                        sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            mb: 0.75,
                        }}
                    >
                        <ListItemText
                            primary={operation.title}
                            secondary={
                                <Box>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {operation.phase}
                                    </Typography>
                                    {formatOperationWindow(
                                        operation
                                    ) !== null && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {formatOperationWindow(
                                                operation
                                            )}
                                        </Typography>
                                    )}
                                </Box>
                            }
                        />
                    </ListItemButton>
                ))
            )}
            <ListItemButton
                component={RouterLink}
                to="/operations"
                onClick={() => onClose()}
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                sx={{ borderRadius: 1 }}
            >
                <ListItemText primary="Activity console" />
            </ListItemButton>
        </List>
    </Popover>
);
