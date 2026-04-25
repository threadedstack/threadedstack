import type { TTerminalSettings } from '@TTH/types'

import { atom } from 'jotai'
import { loadTerminal } from '@TTH/actions/terminal/load'

export const terminalSettingsAtom = atom<TTerminalSettings>(loadTerminal())
