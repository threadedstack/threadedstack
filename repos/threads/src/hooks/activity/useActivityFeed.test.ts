import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseGuiFeed = vi.fn()
const mockUseGuiModes = vi.fn()

vi.mock('@TTH/state/selectors', () => ({
  useGuiFeed: (...args: any[]) => mockUseGuiFeed(...args),
  useGuiModes: (...args: any[]) => mockUseGuiModes(...args),
}))

import { useActivityFeed } from './useActivityFeed'

describe(`useActivityFeed`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`returns the exact feeds array for a session with a feeds entry (reference equality)`, () => {
    const events = [
      { kind: `action`, id: `evt_1`, status: `done`, action: `test`, target: `test` },
    ]
    mockUseGuiFeed.mockReturnValue([new Map([[`sess_1`, events]])])
    mockUseGuiModes.mockReturnValue([new Map()])

    const { result } = renderHook(() => useActivityFeed(`sess_1`))

    expect(result.current.events).toBe(events)
  })

  it(`defaults events to an empty array when feeds has no entry for the session`, () => {
    mockUseGuiFeed.mockReturnValue([new Map()])
    mockUseGuiModes.mockReturnValue([new Map()])

    const { result } = renderHook(() => useActivityFeed(`sess_missing`))

    expect(result.current.events).toEqual([])
  })

  it(`returns the exact mode for a session with a modes entry`, () => {
    mockUseGuiFeed.mockReturnValue([new Map()])
    mockUseGuiModes.mockReturnValue([new Map([[`sess_1`, `tui`]])])

    const { result } = renderHook(() => useActivityFeed(`sess_1`))

    expect(result.current.mode).toBe(`tui`)
  })

  it(`defaults mode to 'interactive' when modes has no entry for the session`, () => {
    mockUseGuiFeed.mockReturnValue([new Map()])
    mockUseGuiModes.mockReturnValue([new Map()])

    const { result } = renderHook(() => useActivityFeed(`sess_missing`))

    expect(result.current.mode).toBe(`interactive`)
  })

  it(`reads feeds and modes independently -- a feeds hit with a modes miss exercises only the mode fallback`, () => {
    const events = [{ kind: `output`, id: `evt_2`, status: `complete`, lines: [] }]
    mockUseGuiFeed.mockReturnValue([new Map([[`sess_1`, events]])])
    mockUseGuiModes.mockReturnValue([new Map()])

    const { result } = renderHook(() => useActivityFeed(`sess_1`))

    expect(result.current.events).toBe(events)
    expect(result.current.mode).toBe(`interactive`)
  })

  it(`reads feeds and modes independently -- a feeds miss with a modes hit exercises only the events fallback`, () => {
    mockUseGuiFeed.mockReturnValue([new Map()])
    mockUseGuiModes.mockReturnValue([new Map([[`sess_1`, `streaming`]])])

    const { result } = renderHook(() => useActivityFeed(`sess_1`))

    expect(result.current.events).toEqual([])
    expect(result.current.mode).toBe(`streaming`)
  })
})
