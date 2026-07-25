import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResolveContext = vi.fn()
const mockResolveInstanceId = vi.fn()
const mockListPorts = vi.fn()
const mockFormatPortsOutput = vi.fn()

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    listPorts: (...args: any[]) => mockListPorts(...args),
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

vi.mock(`@TSA/utils/sandbox/formatPortsOutput`, () => ({
  formatPortsOutput: (...args: any[]) => mockFormatPortsOutput(...args),
}))

import { listTask } from './list'

describe(`ports list task`, () => {
  let errOutput: string[]
  let exitCode: number | undefined

  const errWritten = () => errOutput.join(``)

  beforeEach(() => {
    vi.clearAllMocks()
    errOutput = []
    exitCode = undefined

    vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
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

  const runAction = (params: Record<string, any> = {}, options: any[] = []) =>
    listTask.action!({ params, auth: {}, config: {}, options } as any)

  it(`resolves the sandbox id from params.sandbox`, async () => {
    mockListPorts.mockResolvedValueOnce({
      data: { instanceId: `i1`, exposed: {}, detected: {} },
      error: undefined,
    })

    await runAction({ sandbox: `sb-from-params` })

    expect(mockResolveContext).toHaveBeenCalledWith(
      expect.objectContaining({ explicitSandbox: `sb-from-params` })
    )
  })

  it(`falls back to the positional options[0] for the sandbox id when params.sandbox is absent`, async () => {
    mockListPorts.mockResolvedValueOnce({
      data: { instanceId: `i1`, exposed: {}, detected: {} },
      error: undefined,
    })

    await runAction({}, [`sb-from-options`])

    expect(mockResolveContext).toHaveBeenCalledWith(
      expect.objectContaining({ explicitSandbox: `sb-from-options` })
    )
  })

  it(`no running instance -- writes Error and exits 1, does not call listPorts`, async () => {
    mockResolveInstanceId.mockResolvedValueOnce({ instanceId: undefined })

    await expect(runAction()).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`No running instance found`)
    expect(mockListPorts).not.toHaveBeenCalled()
  })

  it(`listPorts resolves with an error -- writes Error and exits 1, does not call formatPortsOutput`, async () => {
    mockListPorts.mockResolvedValueOnce({ data: undefined, error: { message: `boom` } })

    await expect(runAction()).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`boom`)
    expect(mockFormatPortsOutput).not.toHaveBeenCalled()
  })

  it(`listPorts resolves with falsy data -- writes the fallback message and exits 1`, async () => {
    mockListPorts.mockResolvedValueOnce({ data: undefined, error: undefined })

    await expect(runAction()).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Failed to list ports`)
    expect(mockFormatPortsOutput).not.toHaveBeenCalled()
  })

  it(`listPorts resolves with data -- calls formatPortsOutput once with that data, no exit`, async () => {
    const data = { instanceId: `i1`, exposed: { '3000': {} }, detected: {} }
    mockListPorts.mockResolvedValueOnce({ data, error: undefined })

    await runAction()

    expect(mockFormatPortsOutput).toHaveBeenCalledTimes(1)
    expect(mockFormatPortsOutput).toHaveBeenCalledWith(data)
    expect(process.exit).not.toHaveBeenCalled()
  })
})
