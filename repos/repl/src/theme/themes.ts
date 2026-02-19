import pc from 'picocolors'

export type TThemeColors = {
  primary: (s: string) => string
  secondary: (s: string) => string
  success: (s: string) => string
  warning: (s: string) => string
  error: (s: string) => string
  muted: (s: string) => string
  accent: (s: string) => string
  border: (s: string) => string
  bold: (s: string) => string
}

export const darkTheme: TThemeColors = {
  primary: pc.cyan,
  secondary: pc.dim,
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  muted: pc.gray,
  accent: pc.magenta,
  border: pc.dim,
  bold: pc.bold,
}

export const lightTheme: TThemeColors = {
  primary: pc.blue,
  secondary: pc.dim,
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  muted: pc.gray,
  accent: pc.magenta,
  border: pc.dim,
  bold: pc.bold,
}
