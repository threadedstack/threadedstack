import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResolveContext = vi.fn()
const mockResolveInstanceId = vi.fn()
const mockConnectAndAttach = vi.fn()

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({})),
}))

vi.mock(`@TSA/utils/tasks/ensureAuth`, () => ({
  ensureAuth: (action: any) => action,
}))

vi.mock(`@TSA/utils/tasks/resolveContext`, () => ({
  resolveContext: (...args: any[]) => mockResolveContext(...args),
}))

vi.mock(`@TSA/utils/tasks/resolveInstanceId`, () => ({
  resolveInstanceId: (...args: any[]) => mockResolveInstanceId(...args),
}))

vi.mock(`@TSA/utils/tasks/connectAndAttach`, () => ({
  connectAndAttach: (...args: any[]) => mockConnectAndAttach(...args),
}))

import { start } from './start'

describe(`sessions start task`, () => {
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
    process.exitCode = undefined

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
    mockResolveInstanceId.mockResolvedValue({ instanceId: `inst-1` })
    mockConnectAndAttach.mockResolvedValue(undefined)
  })

  it(`no sandbox id in params or options -- writes Usage message, exits 1, resolveContext never called`, async () => {
    await expect(
      start.action!({ params: {}, auth: {}, config: {}, options: [] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Usage: tsa sessions start <sandbox-id>`)
    expect(mockResolveContext).not.toHaveBeenCalled()
  })

  it(`resolveInstanceId rejects -- writes the error, exits 1, connectAndAttach never called`, async () => {
    mockResolveInstanceId.mockRejectedValue(new Error(`no instance available`))

    await expect(
      start.action!({
        params: { sandbox: `sandbox-1` },
        auth: {},
        config: {},
        options: [],
      } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`no instance available`)
    expect(mockConnectAndAttach).not.toHaveBeenCalled()
  })

  it(`connectAndAttach rejects -- writes the error, sets process.exitCode to 1, process.exit NOT called`, async () => {
    mockConnectAndAttach.mockRejectedValue(new Error(`connection refused`))

    await start.action!({
      params: { sandbox: `sandbox-1` },
      auth: {},
      config: {},
      options: [],
    } as any)

    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`connection refused`)
    expect(process.exitCode).toBe(1)
    expect(exitCode).toBeUndefined()
  })

  it(`happy path -- connectAndAttach is called with run:false and the resolved context/instance values, no error output`, async () => {
    await start.action!({
      params: { sandbox: `sandbox-1` },
      auth: {},
      config: {},
      options: [],
    } as any)

    expect(mockResolveContext).toHaveBeenCalled()
    expect(mockResolveInstanceId).toHaveBeenCalledWith(
      expect.anything(),
      `org-1`,
      `proj-1`,
      `sandbox-1`,
      { explicitInstance: undefined, forceNew: undefined }
    )
    expect(mockConnectAndAttach).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: `org-1`,
        projectId: `proj-1`,
        sandboxId: `sandbox-1`,
        instanceOpts: { instanceId: `inst-1` },
        run: false,
      })
    )
    expect(errWritten()).toBe(``)
    expect(process.exitCode).toBeUndefined()
    expect(exitCode).toBeUndefined()
  })

  it(`sandbox id falls back to options[0] when params.sandbox is not set`, async () => {
    await start.action!({
      params: {},
      auth: {},
      config: {},
      options: [`sandbox-from-opt`],
    } as any)

    expect(mockResolveContext).toHaveBeenCalledWith(
      expect.objectContaining({ explicitSandbox: `sandbox-from-opt` })
    )
    expect(mockConnectAndAttach).toHaveBeenCalled()
  })
})
