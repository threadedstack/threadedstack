import { BreakpointsOptions } from '@mui/material'
import createTheme from '@mui/material/styles/createTheme'
import { gutter } from './gutter'
import { grey, white, colors } from './colors'

const typography = {
  fontFamily: ['Ubuntu', 'serif'].join(','),
}

const components = (isDark?: boolean) => {
  return {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? colors.dark.background : colors.light.background,
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: isDark ? colors.dark.primaryForeground : colors.light.primaryForeground,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: isDark ? colors.dark.background : colors.light.background,
        },
        heading: {
          backgroundColor: isDark
            ? colors.dark.headerBackground
            : colors.light.headerBackground,
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: isDark
            ? colors.dark.headerBackground
            : colors.light.headerBackground,
        },
        content: {
          margin: `0px`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        disableRipple: true,
        sx: {
          textTransform: `none`,
        },
      },
    },
    MuiLink: {
      defaultProps: {
        fontWeight: 500,
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
    MuiOutlinedInput: {
      styleOverrides: {
        input: {
          [`&::placeholder`]: {
            color: isDark ? grey[500] : grey[700],
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        input: {
          [`&::placeholder`]: {
            color: isDark ? grey[500] : grey[700],
          },
        },
      },
    },
    MuiFormHelperText: {
      defaultProps: {
        sx: {
          m: 0,
          fontWeight: 400,
          color: grey[500],
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          padding: `${gutter.tpx} ${gutter.px}`,
          color: isDark ? colors.dark.foreground : colors.light.foreground,
          backgroundColor: isDark ? colors.dark.background : colors.light.background,
        },
      },
    },
  }
}

const success = {
  contrastText: white,
  main: colors.states.success,
}

const darkTheme = (breakpoints?: BreakpointsOptions) =>
  createTheme({
    typography,
    breakpoints: breakpoints,
    components: components(true),
    palette: {
      mode: `dark`,
      success,
      colors: colors.dark,
      border: {
        muted: colors.grey[800],
        section: colors.grey[800],
        default: colors.dark.border,
        highlight: colors.primary[600],
      },
      editor: {
        background: colors.editor.dark.background,
        rbackground: colors.editor.dark.rbackground,
      },
      background: {
        muted: colors.grey[875],
        paper: colors.dark.paper,
        default: colors.dark.background,
        input: colors.dark.inputBackground,
        header: colors.dark.headerBackground,
        section: colors.dark.sectionBackground,
      },
      primary: {
        dark: colors.primary[800],
        light: colors.primary[50],
        main: colors.dark.primary,
        contrastText: colors.dark.primaryForeground,
      },
      secondary: {
        dark: colors.grey[500],
        light: colors.grey[100],
        main: colors.dark.secondary,
        contrastText: colors.dark.secondaryForeground,
      },
      error: {
        main: colors.dark.destructive,
        contrastText: colors.dark.destructiveForeground,
      },
      text: {
        primary: colors.dark.foreground,
        secondary: colors.dark.mutedForeground,
      },
      divider: colors.dark.border,
    },
  })

const lightTheme = (breakpoints?: BreakpointsOptions) =>
  createTheme({
    typography,
    breakpoints: breakpoints,
    components: components(),
    palette: {
      mode: `light`,
      success,
      colors: colors.light,
      border: {
        muted: colors.grey[25],
        section: colors.grey[50],
        default: colors.light.border,
        highlight: colors.primary[100],
      },
      editor: {
        background: colors.editor.light.background,
        rbackground: colors.editor.light.rbackground,
      },
      background: {
        muted: colors.grey[10],
        paper: colors.light.paper,
        default: colors.light.background,
        input: colors.light.inputBackground,
        header: colors.light.headerBackground,
        section: colors.light.sectionBackground,
      },
      primary: {
        dark: colors.primary[800],
        light: colors.primary[300],
        main: colors.light.primary,
        contrastText: colors.light.contrastText,
      },
      secondary: {
        dark: colors.grey[700],
        light: colors.grey[200],
        main: colors.light.secondary,
        contrastText: colors.light.mutedForeground,
      },
      error: {
        main: colors.light.destructive,
        contrastText: colors.light.destructiveForeground,
      },
      divider: colors.light.border,
      text: {
        primary: colors.light.foreground,
        secondary: colors.light.mutedForeground,
      },
    },
  })

export const makeTheme = (variant: `dark` | `light`, breakpoints?: BreakpointsOptions) =>
  variant === `dark` ? darkTheme(breakpoints) : lightTheme(breakpoints)
