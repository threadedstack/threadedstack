import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSandboxSessions = vi.fn()
const mockResolveContext = vi.fn()

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    getSandboxSessions: (...args: any[]) => mockGetSandboxSessions(...args),
  })),
}))

vi.mock(`@TSA/utils/tasks/ensureAuth`, () => ({
  ensureAuth: (action: any) => action,
}))

vi.mock(`@TSA/utils/tasks/resolveContext`, () => ({
  resolveContext: (...args: any[]) => mockResolveContext(...args),
}))

import { list } from './list'

const makeSession = (overrides: Record<string, any> = {}) => ({
  orgId: `org-1`,
  userId: `user-123456789`,
  sandboxId: `sandbox-1`,
  sessionId: `session-abcdefghij`,
  instanceId: `instance-1`,
  connectedAt: `2026-01-01T00:00:00.000Z`,
  visibility: `private`,
  ...overrides,
})

describe(`sessions list task`, () => {
  let output: string[]
  let errOutput: string[]
  let exitCode: number | undefined

  const written = () => output.join(``)
  const errWritten = () => errOutput.join(``)

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NO_COLOR = `1`
    output = []
    errOutput = []
    exitCode = undefined

    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      errOutput.push(String(chunk))
      return true
    })
    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code
      throw new Error(`__EXIT__`)
    })

    mockResolveContext.mockResolvedValue({
      client: {},
      orgId: `org-1`,
      projectId: `proj-1`,
      sandboxId: `sandbox-1`,
    })
  })

  it(`getSandboxSessions resolves with an error -- writes the error and exits 1`, async () => {
    mockGetSandboxSessions.mockResolvedValue({ error: { message: `not found` } })

    await expect(
      list.action!({ params: {}, auth: {}, config: {}, options: [] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`not found`)
  })

  it(`resolves with an empty list -- writes the no-active-sessions message, no header or table`, async () => {
    mockGetSandboxSessions.mockResolvedValue({ data: [] })

    await list.action!({ params: {}, auth: {}, config: {}, options: [] } as any)

    expect(written()).toContain(`No active sessions for sandbox sandbox-1`)
    expect(written()).not.toContain(`Sessions for sandbox`)
  })

  it(`sessions all sharing one instanceId -- does NOT print an Instance: line`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [
        makeSession({ sessionId: `s1`, instanceId: `inst-1` }),
        makeSession({ sessionId: `s2`, instanceId: `inst-1` }),
      ],
    })

    await list.action!({ params: {}, auth: {}, config: {}, options: [] } as any)

    expect(written()).not.toContain(`Instance:`)
    expect(written()).toContain(`Sessions for sandbox sandbox-1`)
  })

  it(`sessions spanning two distinct instanceIds -- prints two Instance: lines, correctly grouped`, async () => {
    const instanceA = `instance-aaaaaaaaaaaaaaaaaaaaaaaa1111`
    const instanceB = `instance-bbbbbbbbbbbbbbbbbbbbbbbb2222`
    mockGetSandboxSessions.mockResolvedValue({
      data: [
        makeSession({ sessionId: `s1`, instanceId: instanceA }),
        makeSession({ sessionId: `s2`, instanceId: instanceB }),
      ],
    })

    await list.action!({ params: {}, auth: {}, config: {}, options: [] } as any)

    const instanceLines = written()
      .split(`\n`)
      .filter((l) => l.includes(`Instance:`))
    expect(instanceLines).toHaveLength(2)
    expect(instanceLines[0]).toContain(instanceA.slice(-16))
    expect(instanceLines[1]).toContain(instanceB.slice(-16))
  })

  it(`a session with a falsy/missing instanceId is grouped under the literal key "unknown"`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [
        makeSession({ sessionId: `s1`, instanceId: `` }),
        makeSession({ sessionId: `s2`, instanceId: `instance-1` }),
      ],
    })

    await list.action!({ params: {}, auth: {}, config: {}, options: [] } as any)

    const instanceLines = written()
      .split(`\n`)
      .filter((l) => l.includes(`Instance:`))
    expect(instanceLines).toHaveLength(2)
    expect(instanceLines.some((l) => l.includes(`unknown`))).toBe(true)
  })

  it(`the header count reflects the total session count across all groups, not per-group`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [
        makeSession({ sessionId: `s1`, instanceId: `inst-a` }),
        makeSession({ sessionId: `s2`, instanceId: `inst-a` }),
        makeSession({ sessionId: `s3`, instanceId: `inst-b` }),
      ],
    })

    await list.action!({ params: {}, auth: {}, config: {}, options: [] } as any)

    expect(written()).toContain(`Sessions for sandbox sandbox-1`)
    expect(written()).toContain(`(3 active)`)
  })
})
