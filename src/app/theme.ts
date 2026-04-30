import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { ThemeMode } from '../state/uiPreferences.slice';

interface AppThemeTokens {
    mode: ThemeMode;
    abyss: string;
    deck: string;
    panel: string;
    panelHigh: string;
    line: string;
    lineStrong: string;
    text: string;
    muted: string;
    dim: string;
    cyan: string;
    blue: string;
    amber: string;
    green: string;
    red: string;
    violet: string;
    appBarBackground: string;
    appBarShadow: string;
    paperShadow: string;
    cardShadow: string;
    dialogShadow: string;
    primaryGradient: string;
    primaryGradientHover: string;
    inputBackground: string;
    drawerBackground: string;
    backdropBackground: string;
    gridAlpha: number;
}

const graphite: AppThemeTokens = {
    mode: 'dark',
    abyss: '#05090d',
    deck: '#091018',
    panel: '#0d1722',
    panelHigh: '#132334',
    line: '#234055',
    lineStrong: '#3a6680',
    text: '#e7f4ff',
    muted: '#8aa1b2',
    dim: '#5f7380',
    cyan: '#27d7ff',
    blue: '#2487ff',
    amber: '#ffb02e',
    green: '#39d47a',
    red: '#ff3d4f',
    violet: '#a778ff',
    appBarBackground: 'rgba(6, 13, 20, 0.94)',
    appBarShadow: '0 12px 28px rgba(0, 0, 0, 0.32)',
    paperShadow: '0 18px 44px rgba(0, 0, 0, 0.32)',
    cardShadow: '0 12px 32px rgba(0, 0, 0, 0.24)',
    dialogShadow:
        '0 24px 70px rgba(0, 0, 0, 0.62), inset 0 1px 0 rgba(118, 232, 255, 0.12)',
    primaryGradient: 'linear-gradient(180deg, #37ddff 0%, #1478c7 100%)',
    primaryGradientHover: 'linear-gradient(180deg, #78eaff 0%, #198eea 100%)',
    inputBackground: 'rgba(5, 9, 13, 0.68)',
    drawerBackground: '#070d14',
    backdropBackground: 'rgba(0, 0, 0, 0.68)',
    gridAlpha: 0.035,
};

const ice: AppThemeTokens = {
    mode: 'light',
    abyss: '#f4f8fb',
    deck: '#eef5f9',
    panel: '#ffffff',
    panelHigh: '#e8f2f7',
    line: '#c7d8e3',
    lineStrong: '#8eb1c4',
    text: '#102532',
    muted: '#526c7c',
    dim: '#8195a1',
    cyan: '#006d8f',
    blue: '#005da8',
    amber: '#a15c00',
    green: '#16784a',
    red: '#b42334',
    violet: '#6546b7',
    appBarBackground: 'rgba(255, 255, 255, 0.94)',
    appBarShadow: '0 12px 28px rgba(16, 37, 50, 0.12)',
    paperShadow: '0 18px 44px rgba(16, 37, 50, 0.12)',
    cardShadow: '0 12px 32px rgba(16, 37, 50, 0.1)',
    dialogShadow:
        '0 24px 70px rgba(16, 37, 50, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    primaryGradient: 'linear-gradient(180deg, #0b88a8 0%, #005e7b 100%)',
    primaryGradientHover: 'linear-gradient(180deg, #139fbe 0%, #006d8f 100%)',
    inputBackground: 'rgba(255, 255, 255, 0.82)',
    drawerBackground: '#ffffff',
    backdropBackground: 'rgba(16, 37, 50, 0.32)',
    gridAlpha: 0.07,
};

const makeAppTheme = (tokens: AppThemeTokens): Theme =>
    createTheme({
        palette: {
            mode: tokens.mode,
            primary: {
                main: tokens.cyan,
                light: tokens.mode === 'dark' ? '#76e8ff' : '#3f9fba',
                dark: tokens.mode === 'dark' ? '#008bb8' : '#004f68',
                contrastText: '#ffffff',
            },
            secondary: {
                main: tokens.violet,
                light: tokens.mode === 'dark' ? '#c5a8ff' : '#8869d8',
                dark: tokens.mode === 'dark' ? '#7450c7' : '#472f8f',
                contrastText: '#ffffff',
            },
            success: {
                main: tokens.green,
                dark: tokens.mode === 'dark' ? '#18a955' : '#0f5d38',
                contrastText: '#ffffff',
            },
            warning: {
                main: tokens.amber,
                dark: tokens.mode === 'dark' ? '#c67b00' : '#704100',
                contrastText: tokens.mode === 'dark' ? '#05090d' : '#ffffff',
            },
            error: {
                main: tokens.red,
                dark: tokens.mode === 'dark' ? '#ba1628' : '#7d1724',
                contrastText: '#ffffff',
            },
            info: {
                main: tokens.blue,
                dark: tokens.mode === 'dark' ? '#0063cc' : '#003f72',
                contrastText: '#ffffff',
            },
            background: {
                default: tokens.abyss,
                paper: tokens.panel,
            },
            text: {
                primary: tokens.text,
                secondary: tokens.muted,
                disabled: tokens.dim,
            },
            divider: tokens.line,
            action: {
                active: tokens.cyan,
                hover: alpha(tokens.cyan, tokens.mode === 'dark' ? 0.09 : 0.08),
                selected: alpha(
                    tokens.cyan,
                    tokens.mode === 'dark' ? 0.16 : 0.13
                ),
                disabled: alpha(tokens.dim, 0.42),
                disabledBackground: alpha(tokens.dim, 0.16),
            },
        },
        shape: {
            borderRadius: 4,
        },
        typography: {
            fontFamily:
                'var(--app-interface-font), Inter, system-ui, Helvetica, Arial, sans-serif',
            h1: { fontWeight: 600, letterSpacing: 0 },
            h2: { fontWeight: 600, letterSpacing: 0 },
            h3: { fontWeight: 600, letterSpacing: 0 },
            h4: { fontWeight: 600, letterSpacing: 0 },
            h5: { fontWeight: 600, letterSpacing: 0 },
            h6: { fontWeight: 600, letterSpacing: 0 },
            button: {
                fontWeight: 700,
                letterSpacing: 0,
                textTransform: 'uppercase',
            },
            caption: {
                letterSpacing: 0,
            },
        },
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: tokens.abyss,
                        backgroundImage: `linear-gradient(${alpha(
                            tokens.cyan,
                            tokens.gridAlpha
                        )} 1px, transparent 1px), linear-gradient(90deg, ${alpha(
                            tokens.cyan,
                            tokens.gridAlpha * 0.72
                        )} 1px, transparent 1px)`,
                        backgroundSize: '48px 48px, 48px 48px',
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        background: tokens.appBarBackground,
                        borderBottom: `1px solid ${tokens.lineStrong}`,
                        boxShadow: tokens.appBarShadow,
                        backdropFilter: 'blur(12px)',
                        color: tokens.text,
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        border: `1px solid ${tokens.line}`,
                        boxShadow: tokens.paperShadow,
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: tokens.panel,
                        border: `1px solid ${tokens.line}`,
                        boxShadow: tokens.cardShadow,
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        backgroundColor: tokens.deck,
                        border: `1px solid ${tokens.lineStrong}`,
                        boxShadow: tokens.dialogShadow,
                    },
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        borderBottom: `1px solid ${tokens.line}`,
                        color: tokens.text,
                        paddingTop: 20,
                        paddingBottom: 16,
                    },
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: {
                        borderTop: `1px solid ${tokens.line}`,
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                variants: [
                    {
                        props: { variant: 'contained', color: 'primary' },
                        style: {
                            background: tokens.primaryGradient,
                            boxShadow:
                                tokens.mode === 'dark'
                                    ? `inset 0 1px 0 ${alpha(
                                          '#ffffff',
                                          0.24
                                      )}, 0 0 18px ${alpha(tokens.cyan, 0.18)}`
                                    : `inset 0 1px 0 ${alpha(
                                          '#ffffff',
                                          0.36
                                      )}, 0 10px 22px ${alpha(tokens.cyan, 0.18)}`,
                            '&:hover': {
                                background: tokens.primaryGradientHover,
                            },
                            '&.Mui-disabled': {
                                background: alpha(tokens.dim, 0.16),
                                color: alpha(tokens.dim, 0.42),
                                boxShadow: 'none',
                            },
                        },
                    },
                ],
                styleOverrides: {
                    root: {
                        borderRadius: 3,
                        minHeight: 40,
                    },
                    outlined: {
                        borderColor: tokens.lineStrong,
                        color: tokens.text,
                        '&:hover': {
                            borderColor: tokens.cyan,
                            backgroundColor: alpha(tokens.cyan, 0.08),
                        },
                    },
                    text: {
                        color: tokens.cyan,
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 3,
                        '&:hover': {
                            backgroundColor: alpha(tokens.cyan, 0.1),
                        },
                    },
                },
            },
            MuiTextField: {
                defaultProps: {
                    variant: 'outlined',
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        backgroundColor: tokens.inputBackground,
                        borderRadius: 3,
                        '& fieldset': {
                            borderColor: tokens.lineStrong,
                        },
                        '&:hover fieldset': {
                            borderColor: tokens.cyan,
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: tokens.cyan,
                            boxShadow: `0 0 0 1px ${alpha(tokens.cyan, 0.24)}`,
                        },
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        color: tokens.muted,
                        '&.Mui-focused': {
                            color: tokens.cyan,
                        },
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottom: `1px solid ${tokens.line}`,
                    },
                    head: {
                        color: tokens.muted,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 3,
                        fontWeight: 700,
                    },
                },
            },
            MuiAccordion: {
                styleOverrides: {
                    root: {
                        backgroundColor: tokens.panel,
                        backgroundImage: 'none',
                        border: `1px solid ${tokens.line}`,
                        boxShadow: 'none',
                        '&:before': {
                            display: 'none',
                        },
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundColor: tokens.drawerBackground,
                        borderRight: `1px solid ${tokens.lineStrong}`,
                    },
                },
            },
            MuiBackdrop: {
                styleOverrides: {
                    root: {
                        backgroundColor: tokens.backdropBackground,
                        backdropFilter: 'blur(2px)',
                    },
                },
            },
        },
    });

/**
 * Central command-console MUI themes for the app shell and feature routes.
 */
export const appThemes: Record<ThemeMode, Theme> = {
    dark: makeAppTheme(graphite),
    light: makeAppTheme(ice),
};
