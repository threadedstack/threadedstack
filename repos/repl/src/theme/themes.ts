import pc from 'picocolors'

export type TThemeColors = {
  bold: (s: string) => string
  error: (s: string) => string
  muted: (s: string) => string
  accent: (s: string) => string
  border: (s: string) => string
  success: (s: string) => string
  warning: (s: string) => string
  primary: (s: string) => string
  secondary: (s: string) => string
}

export const darkTheme: TThemeColors = {
  error: pc.red,
  muted: pc.gray,
  bold: pc.bold,
  border: pc.dim,
  primary: pc.cyan,
  secondary: pc.dim,
  success: pc.green,
  warning: pc.yellow,
  accent: pc.magenta,
}

export const lightTheme: TThemeColors = {
  bold: pc.bold,
  error: pc.red,
  muted: pc.gray,
  border: pc.dim,
  primary: pc.blue,
  secondary: pc.dim,
  success: pc.green,
  accent: pc.magenta,
  warning: pc.yellow,
}
