import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseSandboxSessions = vi.fn()

vi.mock('@TTH/hooks/sandbox/useSandboxSessions', () => ({
  useSandboxSessions: (...args: any[]) => mockUseSandboxSessions(...args),
}))

import { useSandboxHasSession } from './useSandboxHasSession'

describe(`useSandboxHasSession`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`returns true when useSandboxSessions returns a non-empty array`, () => {
    mockUseSandboxSessions.mockReturnValue([{ sessionId: `sess_1` }])

    const { result } = renderHook(() => useSandboxHasSession(`sandbox_1`))

    expect(result.current).toBe(true)
    expect(mockUseSandboxSessions).toHaveBeenCalledWith(`sandbox_1`)
  })

  it(`returns false when useSandboxSessions returns an empty array`, () => {
    mockUseSandboxSessions.mockReturnValue([])

    const { result } = renderHook(() => useSandboxHasSession(`sandbox_1`))

    expect(result.current).toBe(false)
  })
})
