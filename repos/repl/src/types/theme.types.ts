export enum EThemeType {
  auto = `auto`,
  dark = `dark`,
  light = `light`,
}

export type TThemeType = `${EThemeType}`

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
