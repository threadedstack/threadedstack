import type { TViewportMode } from '../ast'

export type TModeContext = {
  isAlternateScreen: boolean
  cursor: { x: number; y: number; visible: boolean }
  dirtyRowCount: number
  consecutiveDirtyCycles: number
  idleDurationMs: number
  hasInteractiveRegion: boolean
}

/**
 * Detect the current viewport mode based on terminal context signals.
 *
 * Rules (evaluated in priority order):
 * 1. Alternate screen buffer active -> 'tui'
 * 2. Many dirty rows sustained without interactive regions -> 'streaming'
 * 3. Cursor visible, nothing dirty, idle for >2s -> 'idle'
 * 4. Everything else -> 'interactive'
 */
export function detectMode(ctx: TModeContext): TViewportMode {
  if (ctx.isAlternateScreen) return 'tui'

  if (
    ctx.dirtyRowCount > 3 &&
    ctx.consecutiveDirtyCycles > 3 &&
    !ctx.hasInteractiveRegion
  ) {
    return 'streaming'
  }

  if (ctx.cursor.visible && ctx.dirtyRowCount === 0 && ctx.idleDurationMs > 2000) {
    return 'idle'
  }

  return 'interactive'
}
