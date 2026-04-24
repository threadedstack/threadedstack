export type TBrowserVTerminal = {
  readonly cols: number
  readonly rows: number
  free: () => void
  markClean: () => void
  /** Returns a DataView over the raw cell grid (cols × rows × 16 bytes). */
  getViewport: () => DataView
  getDirtyRows: () => number[]
  isAlternateScreen: () => boolean
  write: (data: string | Uint8Array) => void
  resize: (newCols: number, newRows: number) => void
  getCursor: () => { x: number; y: number; visible: boolean }
}
