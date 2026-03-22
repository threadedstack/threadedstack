import type { dims } from '@TSC/theme/dims'
import type { colors } from '@TSC/theme/colors'
import type { gutter } from '@TSC/theme/gutter'

export enum EThemeType {
  dark = `dark`,
  light = `light`,
}

export type TThemeType = `${EThemeType}`

export type TThemeColors = (typeof colors)[TThemeType]

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
    alt?: string
    altMuted?: string
    muted?: string
    dark?: string
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
