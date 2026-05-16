import type { ITheme } from '@xterm/xterm'

export type TTerminalThemePreset =
  | `nord`
  | `custom`
  | `dracula`
  | `one-dark`
  | `github-dark`
  | `threadedstack`
  | `solarized-dark`
  | `solarized-light`
  | `catppuccin-mocha`

export type TTerminalSettings = {
  theme: ITheme
  fontSize: number
  scrollback: number
  fontFamily: string
  cursorBlink: boolean
  allowTransparency: boolean
  smoothScrollDuration: number
  themePreset: TTerminalThemePreset
  cursorStyle: `block` | `underline` | `bar`
}
