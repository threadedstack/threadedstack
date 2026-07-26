import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseSandboxSessions = vi.fn()
const mockUseGuiModes = vi.fn()

vi.mock('@TTH/hooks/sandbox/useSandboxSessions', () => ({
  useSandboxSessions: (...args: any[]) => mockUseSandboxSessions(...args),
}))

vi.mock('@TTH/state/selectors', () => ({
  useGuiModes: (...args: any[]) => mockUseGuiModes(...args),
}))

import { useSandboxMode } from './useSandboxMode'
import { ESandboxMode } from '@TTH/types'

describe(`useSandboxMode`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`returns idle when there are no sessions for the sandbox`, () => {
    mockUseSandboxSessions.mockReturnValue([])
    mockUseGuiModes.mockReturnValue([new Map()])

    const { result } = renderHook(() => useSandboxMode(`sandbox_1`))

    expect(result.current).toBe(ESandboxMode.idle)
  })

  it(`returns idle when sessions exist but none have a mode entry in modeMap`, () => {
    mockUseSandboxSessions.mockReturnValue([
      { sessionId: `sess_1` },
      { sessionId: `sess_2` },
    ])
    mockUseGuiModes.mockReturnValue([new Map()])

    const { result } = renderHook(() => useSandboxMode(`sandbox_1`))

    expect(result.current).toBe(ESandboxMode.idle)
  })

  it(`returns idle when modeMap has an idle entry for every session (idle values are explicitly skipped, not just falsy-checked)`, () => {
    mockUseSandboxSessions.mockReturnValue([
      { sessionId: `sess_1` },
      { sessionId: `sess_2` },
    ])
    mockUseGuiModes.mockReturnValue([
      new Map([
        [`sess_1`, ESandboxMode.idle],
        [`sess_2`, ESandboxMode.idle],
      ]),
    ])

    const { result } = renderHook(() => useSandboxMode(`sandbox_1`))

    expect(result.current).toBe(ESandboxMode.idle)
  })

  it(`returns the first non-idle mode found across multiple sessions, even when it belongs to a later session`, () => {
    mockUseSandboxSessions.mockReturnValue([
      { sessionId: `sess_1` },
      { sessionId: `sess_2` },
      { sessionId: `sess_3` },
    ])
    mockUseGuiModes.mockReturnValue([
      new Map([
        [`sess_1`, ESandboxMode.idle],
        [`sess_2`, ESandboxMode.streaming],
        [`sess_3`, ESandboxMode.tui],
      ]),
    ])

    const { result } = renderHook(() => useSandboxMode(`sandbox_1`))

    expect(result.current).toBe(ESandboxMode.streaming)
  })
})
