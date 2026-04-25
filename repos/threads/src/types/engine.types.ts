import type { TCursorState } from './ast.types'

export type TBrowserVTerminal = {
  /** Current column count. Updated by resize(). */
  cols: number
  /** Current row count. Updated by resize(). */
  rows: number
  free: () => void
  markClean: () => void
  /** Returns a DataView over the raw cell grid (cols × rows × 16 bytes). */
  getViewport: () => DataView
  getDirtyRows: () => number[]
  getCursor: () => TCursorState
  isAlternateScreen: () => boolean
  write: (data: string | Uint8Array) => void
  resize: (newCols: number, newRows: number) => void
}
