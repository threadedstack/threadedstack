export type TModeContext = {
  isAlternateScreen: boolean
  cursor: { x: number; y: number; visible: boolean }
  dirtyRowCount: number
  consecutiveDirtyCycles: number
  idleDurationMs: number
  hasInteractiveRegion: boolean
}
