import type { TOpenSession } from '@TTH/types'

import { vi, describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ESandboxSessionVisibility } from '@tdsk/domain'

let sessionsMap = new Map<string, TOpenSession>()
const mockUseOpenSessions = vi.fn(() => [sessionsMap] as [Map<string, TOpenSession>])

vi.mock(`@TTH/state/selectors`, () => ({
  useOpenSessions: () => mockUseOpenSessions(),
}))

import { useSandboxSessions } from './useSandboxSessions'

const makeSession = (overrides: Partial<TOpenSession> = {}): TOpenSession => ({
  runtime: `node`,
  threadId: `thread-1`,
  sandboxId: `sandbox-1`,
  sessionId: `session-1`,
  projectId: `project-1`,
  instanceId: `instance-1`,
  podOwnerUserId: `user-1`,
  visibility: ESandboxSessionVisibility.private,
  ...overrides,
})

describe(`useSandboxSessions`, () => {
  it(`returns an empty array when the sessions map is empty`, () => {
    sessionsMap = new Map()
    const { result } = renderHook(() => useSandboxSessions(`sandbox-1`))

    expect(result.current).toEqual([])
  })

  it(`returns only the sessions matching the given sandboxId`, () => {
    const matchA = makeSession({ sessionId: `s1`, sandboxId: `sandbox-1` })
    const matchB = makeSession({ sessionId: `s2`, sandboxId: `sandbox-1` })
    const other = makeSession({ sessionId: `s3`, sandboxId: `sandbox-2` })
    sessionsMap = new Map([
      [`s1`, matchA],
      [`s2`, matchB],
      [`s3`, other],
    ])

    const { result } = renderHook(() => useSandboxSessions(`sandbox-1`))

    expect(result.current).toEqual([matchA, matchB])
  })

  it(`returns an empty array when no session matches the given sandboxId`, () => {
    sessionsMap = new Map([
      [`s1`, makeSession({ sessionId: `s1`, sandboxId: `sandbox-2` })],
    ])

    const { result } = renderHook(() => useSandboxSessions(`sandbox-1`))

    expect(result.current).toEqual([])
  })

  it(`memoizes the result: an unrelated rerender with the same sessions/sandboxId returns the same array reference`, () => {
    sessionsMap = new Map([
      [`s1`, makeSession({ sessionId: `s1`, sandboxId: `sandbox-1` })],
    ])

    const { result, rerender } = renderHook(
      ({ sandboxId }) => useSandboxSessions(sandboxId),
      { initialProps: { sandboxId: `sandbox-1` } }
    )
    const first = result.current

    rerender({ sandboxId: `sandbox-1` })

    expect(result.current).toBe(first)
  })

  it(`recomputes to a new array reference when sandboxId changes`, () => {
    sessionsMap = new Map([
      [`s1`, makeSession({ sessionId: `s1`, sandboxId: `sandbox-1` })],
      [`s2`, makeSession({ sessionId: `s2`, sandboxId: `sandbox-2` })],
    ])

    const { result, rerender } = renderHook(
      ({ sandboxId }) => useSandboxSessions(sandboxId),
      { initialProps: { sandboxId: `sandbox-1` } }
    )
    const first = result.current
    expect(first).toHaveLength(1)

    rerender({ sandboxId: `sandbox-2` })

    expect(result.current).not.toBe(first)
    expect(result.current).toHaveLength(1)
    expect(result.current[0]!.sandboxId).toBe(`sandbox-2`)
  })

  it(`recomputes to a new array reference when the sessions map changes`, () => {
    sessionsMap = new Map([
      [`s1`, makeSession({ sessionId: `s1`, sandboxId: `sandbox-1` })],
    ])

    const { result, rerender } = renderHook(
      ({ sandboxId }) => useSandboxSessions(sandboxId),
      { initialProps: { sandboxId: `sandbox-1` } }
    )
    const first = result.current

    sessionsMap = new Map([
      [`s1`, makeSession({ sessionId: `s1`, sandboxId: `sandbox-1` })],
      [`s2`, makeSession({ sessionId: `s2`, sandboxId: `sandbox-1` })],
    ])
    rerender({ sandboxId: `sandbox-1` })

    expect(result.current).not.toBe(first)
    expect(result.current).toHaveLength(2)
  })
})
