import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResolveContext = vi.fn()
const mockResolveInstanceId = vi.fn()
const mockListPorts = vi.fn()

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

import { openTask } from './open'

describe(`ports open task`, () => {
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
    mockListPorts.mockResolvedValue({
      data: {
        exposed: { '3000': { port: 3000 } },
        portUrlTemplate: `https://{port}.example.com`,
      },
    })
  })

  it(`missing port arg -- writes Usage, exits 1`, async () => {
    await expect(
      openTask.action!({ params: {}, auth: {}, config: {}, options: [] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Usage: tsa ports open <port> [--sandbox <id>]`)
  })

  it(`invalid (non-numeric) port arg -- writes Usage, exits 1`, async () => {
    await expect(
      openTask.action!({ params: {}, auth: {}, config: {}, options: [`abc`] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Usage: tsa ports open <port> [--sandbox <id>]`)
  })

  it(`no running instance -- writes an Error, exits 1, listPorts never called`, async () => {
    mockResolveInstanceId.mockResolvedValue(undefined)

    await expect(
      openTask.action!({ params: {}, auth: {}, config: {}, options: [`3000`] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`No running instance found`)
    expect(mockListPorts).not.toHaveBeenCalled()
  })

  it(`listPorts resolves with an error -- writes the error, exits 1`, async () => {
    mockListPorts.mockResolvedValue({ error: { message: `boom` } })

    await expect(
      openTask.action!({ params: {}, auth: {}, config: {}, options: [`3000`] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Error:`)
    expect(errWritten()).toContain(`boom`)
  })

  it(`port not present in data.exposed -- writes an "is not exposed" Error, exits 1`, async () => {
    mockListPorts.mockResolvedValue({
      data: { exposed: {}, portUrlTemplate: `https://{port}.example.com` },
    })

    await expect(
      openTask.action!({ params: {}, auth: {}, config: {}, options: [`3000`] } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(errWritten()).toContain(`Port 3000 is not exposed`)
  })

  it(`port exposed but no portUrlTemplate -- writes a Warning via early return, exit/exitCode untouched`, async () => {
    mockListPorts.mockResolvedValue({
      data: { exposed: { '3000': { port: 3000 } }, portUrlTemplate: undefined },
    })

    await openTask.action!({ params: {}, auth: {}, config: {}, options: [`3000`] } as any)

    expect(errWritten()).toContain(`Could not determine port URL`)
    expect(process.exitCode).toBeUndefined()
    expect(exitCode).toBeUndefined()
    expect(written()).toBe(``)
  })

  it(`port exposed with a portUrlTemplate -- writes the templated URL to stdout, no stderr, no exit`, async () => {
    await openTask.action!({ params: {}, auth: {}, config: {}, options: [`3000`] } as any)

    expect(written()).toContain(`https://3000.example.com`)
    expect(errWritten()).toBe(``)
    expect(process.exitCode).toBeUndefined()
    expect(exitCode).toBeUndefined()
  })
})
