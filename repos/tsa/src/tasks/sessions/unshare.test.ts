import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResolveContext = vi.fn()
const mockResolveSessionId = vi.fn()
const mockChangeVisibility = vi.fn()

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({})),
}))

vi.mock(`@TSA/utils/tasks/ensureAuth`, () => ({
  ensureAuth: (action: any) => action,
}))

vi.mock(`@TSA/utils/tasks/resolveContext`, () => ({
  resolveContext: (...args: any[]) => mockResolveContext(...args),
}))

vi.mock(`@TSA/utils/tasks/resolveSessionId`, () => ({
  resolveSessionId: (...args: any[]) => mockResolveSessionId(...args),
}))

vi.mock(`@TSA/utils/sandbox/changeVisibility`, () => ({
  changeVisibility: (...args: any[]) => mockChangeVisibility(...args),
}))

import { unshare } from './unshare'

describe(`sessions unshare task`, () => {
  let output: string[]
  let errOutput: string[]
  let exitCode: number | undefined

  const errWritten = () => errOutput.join(``)

  beforeEach(() => {
    vi.clearAllMocks()
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
      orgId: `org-1`,
      projectId: `proj-1`,
      sandboxId: `sandbox-1`,
    })
  })

  const mockAuth = { creds: vi.fn().mockReturnValue({ apiKey: `key-1` }) }

  it(`resolveSessionId rejects -- writes the error, exits 1, and does not call changeVisibility`, async () => {
    mockResolveSessionId.mockRejectedValue(new Error(`no sessions found`))

    await expect(
      unshare.action!({
        params: {},
        auth: mockAuth,
        config: {},
        options: [],
      } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`no sessions found`)
    expect(mockChangeVisibility).not.toHaveBeenCalled()
  })

  it(`resolveSessionId resolves, changeVisibility resolves -- calls changeVisibility with the resolved sessionId and 'private', does not exit`, async () => {
    mockResolveSessionId.mockResolvedValue(`session-abc`)
    mockChangeVisibility.mockResolvedValue(undefined)

    await unshare.action!({
      params: {},
      auth: mockAuth,
      config: {},
      options: [`session-abc`],
    } as any)

    expect(mockChangeVisibility).toHaveBeenCalledWith(
      expect.anything(),
      `org-1`,
      `proj-1`,
      `session-abc`,
      `private`,
      { apiKey: `key-1` }
    )
    expect(process.exit).not.toHaveBeenCalled()
  })

  it(`changeVisibility rejects -- writes the error and exits 1`, async () => {
    mockResolveSessionId.mockResolvedValue(`session-abc`)
    mockChangeVisibility.mockRejectedValue(new Error(`connection closed`))

    await expect(
      unshare.action!({
        params: {},
        auth: mockAuth,
        config: {},
        options: [`session-abc`],
      } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`connection closed`)
  })
})
