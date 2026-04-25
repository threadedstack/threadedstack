import type { TViewportMode } from '@TTH/types/ast.types'
import type { TModeContext } from '@TTH/types/parser.types'

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
  if (ctx.isAlternateScreen) return `tui`

  if (
    ctx.dirtyRowCount > 3 &&
    ctx.consecutiveDirtyCycles > 3 &&
    !ctx.hasInteractiveRegion
  ) {
    return `streaming`
  }

  if (ctx.cursor.visible && ctx.dirtyRowCount === 0 && ctx.idleDurationMs > 2000) {
    return `idle`
  }

  return `interactive`
}
