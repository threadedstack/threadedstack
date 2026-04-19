import { describe, it, expect } from 'vitest'
import { detectMode } from './modeDetector'
import type { TModeContext } from './modeDetector'

const baseCtx: TModeContext = {
  isAlternateScreen: false,
  cursor: { x: 0, y: 0, visible: true },
  dirtyRowCount: 0,
  consecutiveDirtyCycles: 0,
  idleDurationMs: 0,
  hasInteractiveRegion: false,
}

describe('detectMode', () => {
  it('returns "tui" when alternate screen is active', () => {
    const ctx: TModeContext = { ...baseCtx, isAlternateScreen: true }
    expect(detectMode(ctx)).toBe('tui')
  })

  it('returns "tui" even if streaming conditions are also met', () => {
    const ctx: TModeContext = {
      ...baseCtx,
      isAlternateScreen: true,
      dirtyRowCount: 10,
      consecutiveDirtyCycles: 10,
    }
    expect(detectMode(ctx)).toBe('tui')
  })

  it('returns "streaming" when many dirty rows persist without interactive regions', () => {
    const ctx: TModeContext = {
      ...baseCtx,
      dirtyRowCount: 5,
      consecutiveDirtyCycles: 5,
      hasInteractiveRegion: false,
    }
    expect(detectMode(ctx)).toBe('streaming')
  })

  it('returns "interactive" when hasInteractiveRegion blocks streaming', () => {
    const ctx: TModeContext = {
      ...baseCtx,
      dirtyRowCount: 5,
      consecutiveDirtyCycles: 5,
      hasInteractiveRegion: true,
    }
    expect(detectMode(ctx)).toBe('interactive')
  })

  it('returns "streaming" only when dirtyRowCount > 3 AND consecutiveDirtyCycles > 3', () => {
    // dirtyRowCount exactly 3 should NOT trigger streaming
    expect(detectMode({ ...baseCtx, dirtyRowCount: 3, consecutiveDirtyCycles: 5 })).toBe(
      'interactive'
    )
    // consecutiveDirtyCycles exactly 3 should NOT trigger streaming
    expect(detectMode({ ...baseCtx, dirtyRowCount: 5, consecutiveDirtyCycles: 3 })).toBe(
      'interactive'
    )
  })

  it('returns "idle" when cursor visible, nothing dirty, idle > 2000ms', () => {
    const ctx: TModeContext = {
      ...baseCtx,
      cursor: { x: 5, y: 10, visible: true },
      dirtyRowCount: 0,
      idleDurationMs: 2500,
    }
    expect(detectMode(ctx)).toBe('idle')
  })

  it('returns "interactive" when idle time is exactly 2000ms (not greater)', () => {
    const ctx: TModeContext = {
      ...baseCtx,
      cursor: { x: 0, y: 0, visible: true },
      dirtyRowCount: 0,
      idleDurationMs: 2000,
    }
    expect(detectMode(ctx)).toBe('interactive')
  })

  it('returns "interactive" when cursor is not visible even if idle', () => {
    const ctx: TModeContext = {
      ...baseCtx,
      cursor: { x: 0, y: 0, visible: false },
      dirtyRowCount: 0,
      idleDurationMs: 5000,
    }
    expect(detectMode(ctx)).toBe('interactive')
  })

  it('returns "interactive" as the default fallback', () => {
    expect(detectMode(baseCtx)).toBe('interactive')
  })

  it('returns "interactive" when dirty but not enough to stream', () => {
    const ctx: TModeContext = {
      ...baseCtx,
      dirtyRowCount: 2,
      consecutiveDirtyCycles: 1,
    }
    expect(detectMode(ctx)).toBe('interactive')
  })
})
