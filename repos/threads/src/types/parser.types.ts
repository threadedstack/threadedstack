import type { TCursorState } from '@TTH/types/ast.types'

export type TModeContext = {
  cursor: TCursorState
  dirtyRowCount: number
  idleDurationMs: number
  isAlternateScreen: boolean
  hasInteractiveRegion: boolean
  consecutiveDirtyCycles: number
}
