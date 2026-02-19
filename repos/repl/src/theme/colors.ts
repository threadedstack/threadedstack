import type { TThemeColors } from './themes'
import { darkTheme, lightTheme } from './themes'

let activeTheme: TThemeColors = darkTheme

export function getTheme(name: 'dark' | 'light' | 'auto'): TThemeColors {
  if (name === 'light') return lightTheme
  return darkTheme
}

export function setTheme(name: 'dark' | 'light' | 'auto'): void {
  activeTheme = getTheme(name)
}

export function themed(color: keyof TThemeColors, text: string): string {
  if (process.env.NO_COLOR) return text
  return activeTheme[color](text)
}
