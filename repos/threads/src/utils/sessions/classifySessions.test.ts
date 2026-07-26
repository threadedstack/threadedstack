import type { TSandboxSession } from '@tdsk/domain'
import type { TOpenSession } from '@TTH/types'

import { describe, it, expect } from 'vitest'
import { ESandboxSessionVisibility } from '@tdsk/domain'

import { classifySessions } from './classifySessions'

const makeBackendSession = (
  overrides: Partial<TSandboxSession> = {}
): TSandboxSession => ({
  orgId: `org-1`,
  userId: `user-1`,
  sandboxId: `sandbox-1`,
  sessionId: `session-1`,
  instanceId: `instance-1`,
  connectedAt: `2026-01-01T00:00:00.000Z`,
  visibility: ESandboxSessionVisibility.private,
  ...overrides,
})

const makeLocalSession = (overrides: Partial<TOpenSession> = {}): TOpenSession => ({
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

describe(`classifySessions`, () => {
  it(`classifies an owned session present in localSessions as connected, hasShellSession true even if backend flag is false`, () => {
    const backend = [makeBackendSession({ userId: `me`, hasShellSession: false })]
    const local = [makeLocalSession({ sessionId: `session-1` })]

    const result = classifySessions(backend, local, `me`)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ category: `connected`, hasShellSession: true })
  })

  it(`classifies an owned session absent from localSessions as disconnected, hasShellSession from the backend flag only`, () => {
    const backend = [makeBackendSession({ userId: `me`, hasShellSession: true })]

    const result = classifySessions(backend, [], `me`)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ category: `disconnected`, hasShellSession: true })
  })

  it(`disconnected owned session with no backend hasShellSession flag reports false`, () => {
    const backend = [makeBackendSession({ userId: `me`, hasShellSession: undefined })]

    const result = classifySessions(backend, [], `me`)

    expect(result[0]).toMatchObject({ category: `disconnected`, hasShellSession: false })
  })

  it(`includes a non-owned session with public visibility as category shared`, () => {
    const backend = [
      makeBackendSession({
        userId: `someone-else`,
        visibility: ESandboxSessionVisibility.public,
        hasShellSession: true,
      }),
    ]

    const result = classifySessions(backend, [], `me`)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ category: `shared`, hasShellSession: true })
  })

  it(`excludes a non-owned session with private (non-public) visibility entirely`, () => {
    const backend = [
      makeBackendSession({
        userId: `someone-else`,
        visibility: ESandboxSessionVisibility.private,
      }),
    ]

    const result = classifySessions(backend, [], `me`)

    expect(result).toHaveLength(0)
  })

  it(`synthesizes a local-only session (absent from backendSessions) as connected with hasShellSession true`, () => {
    const local = [makeLocalSession({ sessionId: `local-only`, sandboxId: `sandbox-2` })]

    const result = classifySessions([], local, `me`)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      sessionId: `local-only`,
      sandboxId: `sandbox-2`,
      category: `connected`,
      hasShellSession: true,
      userId: `me`,
    })
  })

  it(`defaults userId to '' for a synthesized local-only session when currentUserId is undefined`, () => {
    const local = [makeLocalSession({ sessionId: `local-only` })]

    const result = classifySessions([], local, undefined)

    expect(result[0]).toMatchObject({ userId: `` })
  })

  it(`with currentUserId undefined, no backend session can match isOwn -- only public-visibility sessions are included`, () => {
    const backend = [
      makeBackendSession({
        sessionId: `s-private`,
        userId: `someone`,
        visibility: ESandboxSessionVisibility.private,
      }),
      makeBackendSession({
        sessionId: `s-public`,
        userId: `someone`,
        visibility: ESandboxSessionVisibility.public,
      }),
    ]

    const result = classifySessions(backend, [], undefined)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ sessionId: `s-public`, category: `shared` })
  })

  it(`sorts by CategoryOrder (connected < disconnected < shared)`, () => {
    const backend = [
      makeBackendSession({
        sessionId: `shared-1`,
        userId: `someone`,
        visibility: ESandboxSessionVisibility.public,
        connectedAt: `2026-01-01T00:00:00.000Z`,
      }),
      makeBackendSession({
        sessionId: `disconnected-1`,
        userId: `me`,
        connectedAt: `2026-01-01T00:00:00.000Z`,
      }),
      makeBackendSession({
        sessionId: `connected-1`,
        userId: `me`,
        connectedAt: `2026-01-01T00:00:00.000Z`,
      }),
    ]
    const local = [makeLocalSession({ sessionId: `connected-1` })]

    const result = classifySessions(backend, local, `me`)

    expect(result.map((r) => r.category)).toEqual([`connected`, `disconnected`, `shared`])
  })

  it(`within the same category, sorts by connectedAt descending (newest first)`, () => {
    const backend = [
      makeBackendSession({
        sessionId: `older`,
        userId: `me`,
        connectedAt: `2026-01-01T00:00:00.000Z`,
      }),
      makeBackendSession({
        sessionId: `newer`,
        userId: `me`,
        connectedAt: `2026-01-02T00:00:00.000Z`,
      }),
    ]

    const result = classifySessions(backend, [], `me`)

    expect(result.map((r) => r.sessionId)).toEqual([`newer`, `older`])
  })
})
