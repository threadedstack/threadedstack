import type { grey, editor, border } from '@TSC/theme/colors'
import type { dims } from '@TSC/theme/dims'
import type { gutter } from '@TSC/theme/gutter'

export enum EThemeType {
  dark = `dark`,
  light = `light`,
}

export type TThemeType = `${EThemeType}`

export type TThemeColors = {
  background?: string
  foreground?: string
  paper?: string
  primary?: string
  primaryForeground?: string
  contrastText?: string
  secondary?: string
  secondaryForeground?: string
  muted?: string
  mutedForeground?: string
  mutedBackground?: string
  accent?: string
  accentForeground?: string
  destructive?: string
  destructiveForeground?: string
  inputBackground?: string
  sectionBackground?: string
  headerBackground?: string
  input?: string
  placeholder?: string
  ring?: string
  shadowColor?: string
  shadowContrast?: string
  shadow?: string
  shadowAlt?: string
  shadowPaper?: string
  grey?: typeof grey
  editor?: (typeof editor)[`light`]
  border?: (typeof border)[`light`]
  states: {
    info: string
    danger: string
    success: string
    warning: string
    disabled: string
  }
}

export type TTSTheme = {
  type?: TThemeType
  dark?: TThemeColors
  light?: TThemeColors
}

declare module '@mui/material/styles' {
  interface Theme {
    dims?: typeof dims
    gutter?: typeof gutter
  }

  interface ThemeOptions {
    dims?: typeof dims
    gutter?: typeof gutter
  }

  interface Border {
    muted?: string
    section?: string
    default?: string
    highlight?: string
  }

  interface Editor {
    background?: string
    rbackground?: string
  }

  interface TypeBackground {
    muted: string
    paper: string
    default: string
    section?: string
    header?: string
    input?: string
  }

  interface Palette {
    border: Border
    editor: Editor
    colors: TThemeColors
    background: TypeBackground
  }

  interface PaletteOptions {
    border?: Border
    editor?: Editor
    colors: TThemeColors
  }
}

export {}
