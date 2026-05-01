import type { ApiClient } from '@TSA/services/api'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSessionId } from './resolveSessionId'

const makeSession = (
  sessionId: string,
  userId = `user1`,
  visibility: `public` | `private` = `private`
) => ({
  sessionId,
  userId,
  visibility,
  connectedAt: `2026-01-01T00:00:00Z`,
})

const makeClient = (sessions: any[] | null, error?: any) =>
  ({
    getSandboxSessions: vi.fn().mockResolvedValue({
      data: sessions,
      ok: !error && !!sessions,
      status: error ? 500 : 200,
      error: error ? { message: error } : undefined,
    }),
  }) as unknown as ApiClient

describe(`resolveSessionId`, () => {
  let originalIsTTY: boolean | undefined
  let stdoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY
    stdoutSpy = vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it(`returns explicit session ID without API call`, async () => {
    const client = makeClient([])
    const result = await resolveSessionId(client, `org1`, `proj1`, `sb1`, `sess_explicit`)
    expect(result).toBe(`sess_explicit`)
    expect(client.getSandboxSessions).not.toHaveBeenCalled()
  })

  it(`auto-selects single session`, async () => {
    const client = makeClient([makeSession(`sess_only`)])
    const result = await resolveSessionId(client, `org1`, `proj1`, `sb1`)
    expect(result).toBe(`sess_only`)
    const output = stdoutSpy.mock.calls.flat().join(``) as string
    expect(output).toContain(`sess_only`)
  })

  it(`throws when no active sessions`, async () => {
    const client = makeClient([])
    await expect(resolveSessionId(client, `org1`, `proj1`, `sb1`)).rejects.toThrow(
      `No active sessions for this sandbox`
    )
  })

  it(`throws when multiple sessions and non-TTY`, async () => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: false,
      writable: true,
      configurable: true,
    })
    const client = makeClient([makeSession(`sess_1`), makeSession(`sess_2`)])
    await expect(resolveSessionId(client, `org1`, `proj1`, `sb1`)).rejects.toThrow(
      `Multiple sessions found. Provide a session ID.`
    )
  })

  it(`throws when API returns error`, async () => {
    const client = makeClient(null, `Internal server error`)
    await expect(resolveSessionId(client, `org1`, `proj1`, `sb1`)).rejects.toThrow(
      `Internal server error`
    )
  })

  it(`throws with generic message when API returns null data and no error`, async () => {
    const client = makeClient(null)
    await expect(resolveSessionId(client, `org1`, `proj1`, `sb1`)).rejects.toThrow(
      `Failed to list sessions`
    )
  })
})
