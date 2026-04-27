import { TerminalFontSettings } from '@TTH/components/Terminal/TerminalFontSettings'
import { TerminalThemeSettings } from '@TTH/components/Terminal/TerminalThemeSettings'
import { TerminalCursorSettings } from '@TTH/components/Terminal/TerminalCursorSettings'
import { TerminalScrollSettings } from '@TTH/components/Terminal/TerminalScrollSettings'

export const TerminalTabPanels = [
  { label: `Font`, Component: TerminalFontSettings },
  { label: `Cursor`, Component: TerminalCursorSettings },
  { label: `Scroll`, Component: TerminalScrollSettings },
  { label: `Theme`, Component: TerminalThemeSettings },
] as const
