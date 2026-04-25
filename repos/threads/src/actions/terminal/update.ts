import type { TTerminalSettings } from '@TTH/types'

import { setTerminal } from '@TTH/actions/terminal/set'
import { getTerminalSettings } from '@TTH/state/accessors'
import { TerminalThemePresets } from '@TTH/constants/terminal'

export const updateTerminal = (patch: Partial<TTerminalSettings>) => {
  const current = getTerminalSettings()
  const updated = { ...current, ...patch }

  // When themePreset changes to a named preset, auto-resolve the theme
  if (patch.themePreset && patch.themePreset !== `custom` && !patch.theme) {
    const presetTheme =
      TerminalThemePresets[patch.themePreset as keyof typeof TerminalThemePresets]
    if (presetTheme) updated.theme = presetTheme
  }

  setTerminal(updated)
}
