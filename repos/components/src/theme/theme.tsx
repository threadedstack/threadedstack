import type { Theme } from '@mui/material'
import type { TTSTheme, TThemeColors, TThemeType } from '@TSC/types'

import { dims } from '@TSC/theme/dims'
import { gutter } from '@TSC/theme/gutter'
import { white, colors as DefColors } from '@TSC/theme/colors'
import createTheme from '@mui/material/styles/createTheme'

const typography = {
  fontFamily: [`Ubuntu`, `serif`].join(`,`),
}

const components = (colors: TThemeColors) => {
  return {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background,
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
    MuiAccordion: {
      styleOverrides: {
        root: {
          backgroundColor: colors.background,
        },
        heading: {
          backgroundColor: colors.headerBackground,
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          backgroundColor: colors.headerBackground,
        },
        content: {
          margin: `0px`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableRipple: true,
        sx: {
          textTransform: `none`,
          boxShadow: `0px 0px 0px 0px transparent`,
          transition: `opacity 0.2s ease, box-shadow 0.2s ease`,
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
            color: colors.placeholder,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        input: {
          [`&::placeholder`]: {
            color: colors.placeholder,
          },
        },
      },
    },
    MuiFormHelperText: {
      defaultProps: {
        sx: {
          m: 0,
          fontWeight: 400,
          color: colors.grey?.[500],
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          color: colors.foreground,
          backgroundColor: colors.background,
          padding: `${gutter.tpx} ${gutter.px}`,
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
