import type { TTerminalSettings } from '@TTH/types'
import { setTerminalSettings } from '@TTH/state/accessors'

export const setTerminal = (settings: TTerminalSettings) => setTerminalSettings(settings)
