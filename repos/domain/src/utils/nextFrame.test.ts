import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextFrame } from './nextFrame'

describe(`nextFrame`, () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it(`should schedule via requestAnimationFrame when it is defined, and invoke the callback`, () => {
    const cb = vi.fn()
    const mockRaf = vi.fn((fn: () => void) => fn())
    vi.stubGlobal(`requestAnimationFrame`, mockRaf)

    nextFrame(cb)

    expect(mockRaf).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it(`should fall back to setTimeout when requestAnimationFrame is undefined, and invoke the callback`, () => {
    vi.useFakeTimers()
    const cb = vi.fn()

    nextFrame(cb)

    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it(`should not throw when called with no callback via the requestAnimationFrame path`, () => {
    const mockRaf = vi.fn((fn: () => void) => fn())
    vi.stubGlobal(`requestAnimationFrame`, mockRaf)

    expect(() => nextFrame(undefined as unknown as () => void)).not.toThrow()
  })

  it(`should not throw when called with no callback via the setTimeout path`, () => {
    vi.useFakeTimers()

    expect(() => nextFrame(undefined as unknown as () => void)).not.toThrow()
    expect(() => vi.advanceTimersByTime(0)).not.toThrow()
  })
})
