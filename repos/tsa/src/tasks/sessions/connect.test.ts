import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetSandboxSessions = vi.fn()
const mockResolveContext = vi.fn()
const mockResolveSessionSandbox = vi.fn()
const mockSaveContext = vi.fn()
const mockConnectAndAttach = vi.fn()

vi.mock(`@TSA/utils/tasks/ensureAuth`, () => ({
  ensureAuth: (action: any) => action,
}))

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    getSandboxSessions: mockGetSandboxSessions,
  })),
}))

vi.mock(`@TSA/utils/tasks/resolveContext`, () => ({
  resolveContext: (...args: any[]) => mockResolveContext(...args),
}))

vi.mock(`@TSA/utils/sandbox/resolveSessionSandbox`, () => ({
  resolveSessionSandbox: (...args: any[]) => mockResolveSessionSandbox(...args),
}))

vi.mock(`@TSA/utils/tasks/saveContext`, () => ({
  saveContext: (...args: any[]) => mockSaveContext(...args),
}))

vi.mock(`@TSA/utils/tasks/connectAndAttach`, () => ({
  connectAndAttach: (...args: any[]) => mockConnectAndAttach(...args),
}))

import { connect } from './connect'

describe(`sessions connect task`, () => {
  let output: string[]
  let errOutput: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    output = []
    errOutput = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      errOutput.push(String(chunk))
      return true
    })
    // Matches the cli.test.ts precedent: a no-op exit, not a throwing one --
    // connect.ts has no `return` after several of its process.exit(1) calls,
    // so a no-op mock is required to observe the file's real fallthrough behavior.
    vi.spyOn(process, `exit`).mockImplementation((() => undefined) as any)
    process.exitCode = undefined

    mockResolveContext.mockResolvedValue({ orgId: `org-1`, projectId: `proj-1` })
    mockConnectAndAttach.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  const joinedErr = () => errOutput.join(``)

  const run = async (args: any = {}) => {
    try {
      await connect.action!({
        params: {},
        auth: {},
        config: {},
        options: [`session-x`],
        ...args,
      } as any)
    } catch {
      // Some branches (documented in the task) intentionally fall through past
      // an un-returned process.exit(1) into code that dereferences an
      // undefined value -- that's the real current behavior being tested,
      // not a bug in this test.
    }
  }

  it(`no sessionId -- writes the Usage message, exits 1, and still calls resolveContext (fallthrough)`, async () => {
    mockResolveSessionSandbox.mockResolvedValue({
      sandboxId: `sb-fallback`,
      session: { instanceId: `inst-fallback` },
    })

    await run({ options: [] })

    expect(joinedErr()).toContain(`Usage: tsa sessions connect <session-id>`)
    expect(process.exit).toHaveBeenCalledWith(1)
    expect(mockResolveContext).toHaveBeenCalled()
  })

  it(`sandbox provided, getSandboxSessions errors -- writes the error and exits 1`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: undefined,
      error: { message: `fetch failed` },
    })

    await run({ params: { sandbox: `sb-1` } })

    expect(joinedErr()).toContain(`Error:`)
    expect(joinedErr()).toContain(
      `Failed to fetch sessions for sandbox sb-1: fetch failed`
    )
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it(`sandbox provided, no session match -- writes a Warning and calls connectAndAttach without instanceOpts`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [{ sessionId: `other-session`, instanceId: `inst-other` }],
      error: undefined,
    })

    await run({ params: { sandbox: `sb-1` } })

    expect(joinedErr()).toContain(`Warning:`)
    expect(joinedErr()).toContain(`Session session-x not found in sandbox sb-1`)
    expect(process.exit).not.toHaveBeenCalled()
    expect(mockConnectAndAttach).toHaveBeenCalledTimes(1)
    const callArgs = mockConnectAndAttach.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty(`instanceOpts`)
  })

  it(`sandbox provided, a session matches -- calls connectAndAttach with instanceOpts.instanceId`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [{ sessionId: `session-x`, instanceId: `inst-match` }],
      error: undefined,
    })

    await run({ params: { sandbox: `sb-1` } })

    expect(mockConnectAndAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxId: `sb-1`,
        sessionId: `session-x`,
        instanceOpts: { instanceId: `inst-match` },
      })
    )
  })

  it(`no sandbox, resolveSessionSandbox resolves undefined -- writes the error and exits 1`, async () => {
    mockResolveSessionSandbox.mockResolvedValue(undefined)

    await run()

    expect(joinedErr()).toContain(`Error:`)
    expect(joinedErr()).toContain(`Could not find session session-x in any sandbox`)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it(`no sandbox, resolveSessionSandbox resolves -- sandboxId/instanceOpts come from the result`, async () => {
    mockResolveSessionSandbox.mockResolvedValue({
      sandboxId: `sb-resolved`,
      session: { instanceId: `inst-resolved` },
    })

    await run()

    expect(mockConnectAndAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        sandboxId: `sb-resolved`,
        instanceOpts: { instanceId: `inst-resolved` },
      })
    )
  })

  it(`calls saveContext with the resolved org/project/sandbox when config is truthy`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [{ sessionId: `session-x`, instanceId: `inst-match` }],
      error: undefined,
    })

    await run({ params: { sandbox: `sb-1` }, config: { org: `org-1` } })

    expect(mockSaveContext).toHaveBeenCalledWith(
      { org: `org-1` },
      `org-1`,
      `proj-1`,
      `sb-1`
    )
  })

  it(`does not call saveContext when config is falsy`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [{ sessionId: `session-x`, instanceId: `inst-match` }],
      error: undefined,
    })

    await run({ params: { sandbox: `sb-1` }, config: undefined })

    expect(mockSaveContext).not.toHaveBeenCalled()
  })

  it(`connectAndAttach rejecting sets process.exitCode instead of calling process.exit`, async () => {
    mockGetSandboxSessions.mockResolvedValue({
      data: [{ sessionId: `session-x`, instanceId: `inst-match` }],
      error: undefined,
    })
    mockConnectAndAttach.mockRejectedValue(new Error(`ssh failed`))

    await run({ params: { sandbox: `sb-1` } })

    expect(joinedErr()).toContain(`Error:`)
    expect(joinedErr()).toContain(`ssh failed`)
    expect(process.exitCode).toBe(1)
    expect(process.exit).not.toHaveBeenCalled()
  })
})
