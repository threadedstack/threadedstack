import type { TTerminalSettings } from '@TTH/types'

import { storage } from '@TTH/services/storage'
import { validateTerminal } from '@TTH/utils/terminal/validate'
import { DefaultTerminalSettings } from '@TTH/constants/terminal'
import { TerminalSettingsStorageKey } from '@TTH/constants/storage'

export const loadTerminal = (): TTerminalSettings => {
  const saved = storage.get<Partial<TTerminalSettings>>(TerminalSettingsStorageKey)
  return saved ? validateTerminal(saved) : DefaultTerminalSettings
}
