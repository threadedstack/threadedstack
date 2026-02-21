import type { TThemeColors } from '@TRL/types'

import pc from 'picocolors'
import { EThemeType } from '@TRL/types'

export const colors: Record<keyof Omit<typeof EThemeType, `auto`>, TThemeColors> = {
  [EThemeType.dark]: {
    error: pc.red,
    muted: pc.gray,
    bold: pc.bold,
    border: pc.dim,
    primary: pc.cyan,
    secondary: pc.dim,
    success: pc.green,
    warning: pc.yellow,
    accent: pc.magenta,
  },
  [EThemeType.light]: {
    bold: pc.bold,
    error: pc.red,
    muted: pc.gray,
    border: pc.dim,
    primary: pc.blue,
    secondary: pc.dim,
    success: pc.green,
    accent: pc.magenta,
    warning: pc.yellow,
  },
}

let activeTheme: TThemeColors = colors.dark

export const getTheme = (name: `dark` | `light` | `auto`): TThemeColors => {
  if (name === `light`) return colors.light
  return colors.dark
}

export const setTheme = (name: `dark` | `light` | `auto`): void => {
  activeTheme = getTheme(name)
}

export const themed = (color: keyof TThemeColors, text: string): string => {
  if (process.env.NO_COLOR) return text
  return activeTheme[color](text)
}
