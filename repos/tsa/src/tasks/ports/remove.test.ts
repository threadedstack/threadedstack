import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResolveContext = vi.fn()
const mockResolveInstanceId = vi.fn()
const mockRemovePort = vi.fn()

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    removePort: (...args: any[]) => mockRemovePort(...args),
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

import { removeTask } from './remove'

describe(`ports remove task`, () => {
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
    mockRemovePort.mockResolvedValue({})
  })

  it(`missing port arg -- writes Usage, exits 1`, async () => {
    await expect(
      removeTask.action!({ params: {}, auth: {}, config: {}, options: [] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Usage: tsa ports remove <port> [--sandbox <id>]`)
  })

  it(`invalid (non-numeric) port arg -- writes Usage, exits 1`, async () => {
    await expect(
      removeTask.action!({ params: {}, auth: {}, config: {}, options: [`abc`] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Usage: tsa ports remove <port> [--sandbox <id>]`)
  })

  it(`no running instance -- writes an Error, exits 1, removePort never called`, async () => {
    mockResolveInstanceId.mockResolvedValue(undefined)

    await expect(
      removeTask.action!({ params: {}, auth: {}, config: {}, options: [`3000`] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`No running instance found`)
    expect(mockRemovePort).not.toHaveBeenCalled()
  })

  it(`removePort resolves with an error -- writes the error, exits 1`, async () => {
    mockRemovePort.mockResolvedValue({ error: { message: `boom` } })

    await expect(
      removeTask.action!({ params: {}, auth: {}, config: {}, options: [`3000`] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`boom`)
  })

  it(`removePort succeeds -- writes "Done: Port <port> removed", called with args in the exact order`, async () => {
    await removeTask.action!({
      params: {},
      auth: {},
      config: {},
      options: [`3000`],
    } as any)

    expect(written()).toContain(`Done:`)
    expect(written()).toContain(`removed`)
    expect(written()).toContain(`3000`)
    expect(mockRemovePort).toHaveBeenCalledWith(
      `org-1`,
      `proj-1`,
      `sandbox-1`,
      3000,
      `inst-1`
    )
    expect(errWritten()).toBe(``)
    expect(exitCode).toBeUndefined()
  })
})
