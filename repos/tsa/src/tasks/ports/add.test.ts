import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResolveContext = vi.fn()
const mockResolveInstanceId = vi.fn()
const mockExposePort = vi.fn()

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    exposePort: (...args: any[]) => mockExposePort(...args),
  })),
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

import { addTask } from './add'

describe(`ports add task`, () => {
  let output: string[]
  let errOutput: string[]
  let exitCode: number | undefined

  const written = () => output.join(``)
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
    mockResolveInstanceId.mockResolvedValue({ instanceId: `instance-1` })
  })

  const runAction = (params: Record<string, any> = {}, options: any[] = [`3000`]) =>
    addTask.action!({ params, auth: {}, config: {}, options } as any)

  it(`missing port arg -- writes Usage and exits 1`, async () => {
    await expect(runAction({}, [])).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Usage: tsa ports add <port> [--sandbox <id>]`)
    expect(mockResolveContext).not.toHaveBeenCalled()
  })

  it(`non-numeric port arg -- writes Usage and exits 1`, async () => {
    await expect(runAction({}, [`abc`])).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Usage: tsa ports add <port> [--sandbox <id>]`)
    expect(mockResolveContext).not.toHaveBeenCalled()
  })

  it(`no running instance -- writes Error and exits 1, does not call exposePort`, async () => {
    mockResolveInstanceId.mockResolvedValueOnce({ instanceId: undefined })

    await expect(runAction()).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`No running instance found`)
    expect(mockExposePort).not.toHaveBeenCalled()
  })

  it(`exposePort resolves with an error -- writes Error and exits 1`, async () => {
    mockExposePort.mockResolvedValueOnce({
      data: null,
      error: { message: `port in use` },
    })

    await expect(runAction()).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`port in use`)
  })

  it(`success without protocol and without data.url -- writes Done only, exposePort called with protocol undefined`, async () => {
    mockExposePort.mockResolvedValueOnce({ data: {}, error: undefined })

    await runAction({})

    expect(mockExposePort).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sandbox-1`,
      `instance-1`,
      3000,
      undefined
    )
    expect(written()).toContain(`Done:`)
    expect(written()).toContain(`3000`)
    expect(written()).not.toContain(`URL:`)
    expect(process.exit).not.toHaveBeenCalled()
  })

  it(`success with a protocol option and a data.url -- exposePort called with protocol, writes Done and URL lines`, async () => {
    mockExposePort.mockResolvedValueOnce({
      data: { url: `https://example.com` },
      error: undefined,
    })

    await runAction({ protocol: `https` })

    expect(mockExposePort).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sandbox-1`,
      `instance-1`,
      3000,
      `https`
    )
    expect(written()).toContain(`Done:`)
    expect(written()).toContain(`URL:`)
    expect(written()).toContain(`https://example.com`)
  })
})
