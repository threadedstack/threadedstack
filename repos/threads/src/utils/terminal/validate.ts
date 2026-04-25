import type { TTerminalSettings } from '@TTH/types'

import {
  TerminalThemePresets,
  TerminalCursorStyles,
  TerminalFontOptions,
  TerminalFontSizeRange,
  DefaultTerminalSettings,
  TerminalScrollbackRange,
  TerminalSmoothScrollRange,
} from '@TTH/constants/terminal'

const clamp = (value: number, min: number, max: number) => {
  const n = Number(value)
  return Number.isNaN(n) ? min : Math.max(min, Math.min(max, n))
}

const validFontFamilies = new Set<string>(TerminalFontOptions.map((o) => o.value))
const validCursorStyles = new Set<string>(TerminalCursorStyles.map((o) => o.value))
const validPresets = new Set<string>([...Object.keys(TerminalThemePresets), `custom`])

export const validateTerminal = (raw: Partial<TTerminalSettings>): TTerminalSettings => {
  const base = { ...DefaultTerminalSettings, ...raw }

  return {
    fontSize: clamp(base.fontSize, TerminalFontSizeRange.min, TerminalFontSizeRange.max),
    fontFamily: validFontFamilies.has(base.fontFamily)
      ? base.fontFamily
      : DefaultTerminalSettings.fontFamily,
    cursorStyle: validCursorStyles.has(base.cursorStyle)
      ? base.cursorStyle
      : DefaultTerminalSettings.cursorStyle,
    cursorBlink:
      typeof base.cursorBlink === `boolean`
        ? base.cursorBlink
        : DefaultTerminalSettings.cursorBlink,
    scrollback: clamp(
      base.scrollback,
      TerminalScrollbackRange.min,
      TerminalScrollbackRange.max
    ),
    smoothScrollDuration: clamp(
      base.smoothScrollDuration,
      TerminalSmoothScrollRange.min,
      TerminalSmoothScrollRange.max
    ),
    allowTransparency:
      typeof base.allowTransparency === `boolean`
        ? base.allowTransparency
        : DefaultTerminalSettings.allowTransparency,
    themePreset: validPresets.has(base.themePreset)
      ? base.themePreset
      : DefaultTerminalSettings.themePreset,
    theme:
      base.theme &&
      typeof base.theme === `object` &&
      !Array.isArray(base.theme) &&
      typeof (base.theme as Record<string, unknown>).background === `string` &&
      typeof (base.theme as Record<string, unknown>).foreground === `string`
        ? base.theme
        : DefaultTerminalSettings.theme,
  }
}
