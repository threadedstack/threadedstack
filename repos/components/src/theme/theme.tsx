import type { Theme } from '@mui/material'
import type { TTSTheme, TThemeColors, TThemeType } from '@TSC/types'

import { dims } from '@TSC/theme/dims'
import { cmx } from '@TSC/theme/helpers'
import { gutter } from '@TSC/theme/gutter'
import createTheme from '@mui/material/styles/createTheme'
import { white, colors as DefColors } from '@TSC/theme/colors'

const typography = {
  fontFamily: [`Ubuntu`, `sans-serif`].join(`,`),
  h1: {
    fontSize: `2.25rem`,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: `-0.025em`,
  },
  h2: {
    fontSize: `1.875rem`,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: `-0.02em`,
  },
  h3: { fontSize: `1.5rem`, fontWeight: 600, lineHeight: 1.3, letterSpacing: `-0.015em` },
  h4: {
    fontSize: `1.25rem`,
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: `-0.01em`,
  },
  h5: { fontSize: `1.125rem`, fontWeight: 600, lineHeight: 1.4 },
  h6: { fontSize: `1rem`, fontWeight: 600, lineHeight: 1.5 },
  subtitle1: { fontSize: `0.9375rem`, fontWeight: 500, lineHeight: 1.5 },
  subtitle2: { fontSize: `0.8125rem`, fontWeight: 500, lineHeight: 1.5 },
  body1: { fontSize: `0.875rem`, fontWeight: 400, lineHeight: 1.6 },
  body2: { fontSize: `0.8125rem`, fontWeight: 400, lineHeight: 1.5 },
  caption: {
    fontSize: `0.75rem`,
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: `0.01em`,
  },
  overline: {
    fontSize: `0.6875rem`,
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: `0.08em`,
    textTransform: `uppercase` as const,
  },
  button: {
    fontSize: `0.8125rem`,
    fontWeight: 500,
    lineHeight: 1.5,
    textTransform: `none` as const,
  },
}

const components = (colors: TThemeColors) => {
  return {
    MuiCssBaseline: {
      styleOverrides: {
        '::selection': {
          backgroundColor: cmx(colors.primary, 30),
          color: colors.foreground,
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: `none`,
          borderRadius: dims.border.mdpx,
          backgroundColor: colors.background,
        },
        outlined: {
          border: `1px solid ${colors.border?.default}`,
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: colors.primaryForeground,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableRipple: true,
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: `0.8125rem`,
          textTransform: `none` as const,
          borderRadius: dims.border.smpx,
          padding: `${gutter.hpx} ${gutter.px}`,
          transition: `all 0.15s ease`,
          [`&:hover`]: {
            transform: `translateY(-1px)`,
          },
          [`&:active`]: {
            transform: `translateY(0)`,
          },
        },
        contained: {
          boxShadow: `none`,
          [`&:hover`]: {
            boxShadow: colors.shadows?.sm,
          },
        },
        outlined: {
          borderColor: colors.border?.default,
          [`&:hover`]: {
            borderColor: colors.primary,
            backgroundColor: cmx(colors.primary, 8),
          },
        },
        text: {
          [`&:hover`]: {
            backgroundColor: cmx(colors.primary, 8),
          },
        },
        sizeSmall: {
          padding: `${gutter.qpx} ${gutter.cpx}`,
          fontSize: `0.75rem`,
        },
        sizeLarge: {
          padding: `${gutter.tpx} ${gutter.mpx}`,
          fontSize: `0.9375rem`,
        },
      },
    },
    MuiIconButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: dims.border.smpx,
          transition: `all 0.15s ease`,
          [`&:hover`]: {
            backgroundColor: cmx(colors.foreground, 8),
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: dims.border.mdpx,
          border: `1px solid ${colors.border?.default}`,
          backgroundColor: colors.paper,
          transition: `all 0.2s ease`,
          [`&:hover`]: {
            borderColor: colors.border?.muted,
            boxShadow: colors.shadows?.sm,
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: gutter.rpx,
          [`&:last-child`]: {
            paddingBottom: gutter.rpx,
          },
        },
      },
    },
    MuiCardActions: {
      styleOverrides: {
        root: {
          padding: `${gutter.tpx} ${gutter.rpx}`,
          borderTop: `1px solid ${colors.border?.default}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: dims.border.xspx,
          fontWeight: 500,
          fontSize: `0.75rem`,
          height: `24px`,
        },
        sizeSmall: {
          height: `20px`,
          fontSize: `0.6875rem`,
        },
        outlined: {
          borderColor: colors.border?.default,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: dims.border.smpx,
          backgroundColor: colors.inputBackground,
          transition: `border-color 0.15s ease, box-shadow 0.15s ease`,
          [`& fieldset`]: {
            borderColor: colors.border?.default,
            transition: `border-color 0.15s ease`,
          },
          [`&:hover .MuiOutlinedInput-notchedOutline`]: {
            borderColor: colors.border?.altMuted,
          },
          [`&.Mui-focused .MuiOutlinedInput-notchedOutline`]: {
            borderColor: colors.primary,
            borderWidth: `1px`,
          },
        },
        input: {
          [`&::placeholder`]: {
            color: colors.placeholder,
            opacity: 1,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          borderRadius: dims.border.smpx,
          backgroundColor: colors.inputBackground,
          [`&:hover`]: {
            backgroundColor: colors.mutedBackground,
          },
          [`&.Mui-focused`]: {
            backgroundColor: colors.inputBackground,
          },
          [`&::before, &::after`]: {
            display: `none`,
          },
        },
        input: {
          [`&::placeholder`]: {
            color: colors.placeholder,
            opacity: 1,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: `0.8125rem`,
          fontWeight: 500,
          color: colors.mutedForeground,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: `outlined` as const,
        size: `small` as const,
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: dims.border.lgpx,
          boxShadow: colors.shadows?.lg,
          border: `1px solid ${colors.border?.default}`,
          backgroundImage: `none`,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: `1.125rem`,
          fontWeight: 600,
          padding: `${gutter.rpx} ${gutter.mpx}`,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: `${gutter.px} ${gutter.mpx}`,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: `${gutter.px} ${gutter.mpx}`,
          gap: gutter.hpx,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          boxShadow: colors.shadows?.xl,
          backgroundImage: `none`,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: `40px`,
        },
        indicator: {
          height: `2px`,
          borderRadius: `1px`,
        },
      },
    },
    MuiTab: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          minHeight: `40px`,
          textTransform: `none` as const,
          fontWeight: 500,
          fontSize: `0.8125rem`,
          padding: `${gutter.hpx} ${gutter.px}`,
          transition: `color 0.15s ease`,
          [`&.Mui-selected`]: {
            fontWeight: 600,
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: dims.border.mdpx,
          border: `1px solid ${colors.border?.default}`,
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: colors.headerBackground,
          [`& .MuiTableCell-root`]: {
            fontWeight: 600,
            fontSize: `0.75rem`,
            letterSpacing: `0.05em`,
            color: colors.mutedForeground,
            textTransform: `uppercase` as const,
            padding: `${gutter.tpx} ${gutter.px}`,
            borderBottom: `1px solid ${colors.border?.default}`,
          },
        },
      },
    },
    MuiTableBody: {
      styleOverrides: {
        root: {
          [`& .MuiTableRow-root`]: {
            backgroundColor: colors.paper,
            transition: `background-color 0.1s ease`,
            [`&:hover`]: {
              backgroundColor: cmx(colors.primary, 4),
            },
            [`&:last-child .MuiTableCell-root`]: {
              borderBottom: `none`,
            },
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: `0.8125rem`,
          padding: `${gutter.tpx} ${gutter.px}`,
          borderBottom: `1px solid ${colors.border?.default}`,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
      },
      styleOverrides: {
        tooltip: {
          fontSize: `0.75rem`,
          fontWeight: 500,
          borderRadius: dims.border.mdpx,
          padding: `${gutter.hpx} ${gutter.tpx}`,
          backgroundColor: colors.foreground,
          color: colors.background,
          boxShadow: colors.shadows?.md,
        },
        arrow: {
          color: colors.foreground,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: dims.border.mdpx,
          boxShadow: colors.shadows?.md,
          border: `1px solid ${colors.border?.default}`,
          minWidth: `180px`,
          padding: gutter.qpx,
        },
        list: {
          padding: `0`,
        },
      },
    },
    MuiMenuItem: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          fontSize: `0.8125rem`,
          padding: `${gutter.hpx} ${gutter.tpx}`,
          borderRadius: dims.border.xspx,
          margin: `2px 0`,
          transition: `background-color 0.1s ease`,
          [`&:hover`]: {
            backgroundColor: cmx(colors.primary, 8),
          },
          [`&.Mui-selected`]: {
            backgroundColor: cmx(colors.primary, 12),
            [`&:hover`]: {
              backgroundColor: cmx(colors.primary, 16),
            },
          },
        },
      },
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: colors.background,
          border: `1px solid ${colors.border?.default}`,
          borderRadius: `${dims.border.mdpx} !important`,
          [`&:before`]: {
            display: `none`,
          },
          [`&.Mui-expanded`]: {
            margin: 0,
          },
          [`& + &`]: {
            marginTop: gutter.hpx,
          },
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: colors.headerBackground,
          borderRadius: dims.border.mdpx,
          minHeight: `44px`,
          padding: `0 ${gutter.px}`,
          [`&.Mui-expanded`]: {
            minHeight: `44px`,
            borderRadius: `${dims.border.mdpx} ${dims.border.mdpx} 0 0`,
            borderBottom: `1px solid ${colors.border?.default}`,
          },
        },
        content: {
          margin: `${gutter.hpx} 0`,
          [`&.Mui-expanded`]: {
            margin: `${gutter.hpx} 0`,
          },
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          padding: gutter.qpx,
        },
      },
    },
    MuiListItemButton: {
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          borderRadius: dims.border.smpx,
          padding: `${gutter.hpx} ${gutter.tpx}`,
          transition: `background-color 0.1s ease`,
          [`&:hover`]: {
            backgroundColor: cmx(colors.foreground, 6),
          },
          [`&.Mui-selected`]: {
            backgroundColor: cmx(colors.primary, 10),
            [`&:hover`]: {
              backgroundColor: cmx(colors.primary, 14),
            },
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: `0.6875rem`,
          fontWeight: 600,
          minWidth: `18px`,
          height: `18px`,
          borderRadius: dims.border.xspx,
        },
      },
    },
    MuiSwitch: {
      defaultProps: {
        disableRipple: true,
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: dims.border.mdpx,
          fontSize: `0.8125rem`,
          border: `1px solid`,
          alignItems: `center`,
        },
        standardSuccess: {
          borderColor: cmx(colors.states?.success, 30),
          backgroundColor: cmx(colors.states?.success, 8),
        },
        standardError: {
          borderColor: cmx(colors.states?.danger, 30),
          backgroundColor: cmx(colors.states?.danger, 8),
        },
        standardWarning: {
          borderColor: cmx(colors.states?.warning, 30),
          backgroundColor: cmx(colors.states?.warning, 8),
        },
        standardInfo: {
          borderColor: cmx(colors.states?.info, 30),
          backgroundColor: cmx(colors.states?.info, 8),
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: colors.border?.default,
        },
      },
    },
    MuiLink: {
      defaultProps: {
        fontWeight: 500,
        underline: `hover` as const,
      },
      styleOverrides: {
        root: {
          color: colors.primary,
          transition: `color 0.15s ease`,
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          marginBottom: `0px`,
          marginTop: gutter.qpx,
        },
      },
    },
    MuiFormHelperText: {
      defaultProps: {
        sx: {
          m: 0,
          mt: 0.5,
          fontWeight: 400,
          fontSize: `0.75rem`,
          color: colors.grey?.[500],
        },
      },
    },
  }
}

const breakpoints = {
  values: {
    xs: 0,
    sm: 375,
    md: 720,
    lg: 1280,
    xl: 1536,
  },
}

const buildTheme = (mode: TThemeType, colors: TThemeColors) =>
  createTheme({
    dims,
    gutter,
    typography,
    breakpoints,
    components: components(colors),
    palette: {
      mode,
      colors,
      success: {
        contrastText: white,
        main: colors?.states?.success,
      },
      border: colors.border,
      editor: {
        background: colors.editor?.background,
        rbackground: colors.editor?.rbackground,
      },
      background: {
        paper: colors.paper,
        default: colors.background,
        input: colors.inputBackground,
        muted: colors.mutedBackground,
        header: colors.headerBackground,
        section: colors.sectionBackground,
      },
      primary: {
        dark: colors.primary?.[800],
        light: colors.primary?.[300],
        main: colors.primary,
        contrastText: colors.contrastText,
      },
      secondary: {
        dark: colors.grey?.[700],
        light: colors.grey?.[200],
        main: colors.secondary,
        contrastText: colors.mutedForeground,
      },
      error: {
        main: colors.destructive,
        contrastText: colors.destructiveForeground,
      },
      divider: colors.border?.default,
      text: {
        primary: colors.foreground,
        secondary: colors.secondaryForeground,
      },
    },
  })

export const makeTheme = (theme: TTSTheme): Theme => {
  const { type } = theme
  return buildTheme(type, { ...DefColors[type], ...theme[type] })
}
