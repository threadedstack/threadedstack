import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockListSandboxes = vi.fn()
const mockResolveContext = vi.fn()
const mockGetAlias = vi.fn()
const mockSaveContext = vi.fn()

vi.mock(`@TSA/utils/tasks/ensureAuth`, () => ({
  ensureAuth: (action: any) => action,
}))

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    listSandboxes: mockListSandboxes,
  })),
}))

vi.mock(`@TSA/utils/tasks/resolveContext`, () => ({
  resolveContext: (...args: any[]) => mockResolveContext(...args),
}))

vi.mock(`@TSA/utils/sandbox/getAlias`, () => ({
  getAlias: (...args: any[]) => mockGetAlias(...args),
}))

vi.mock(`@TSA/utils/tasks/saveContext`, () => ({
  saveContext: (...args: any[]) => mockSaveContext(...args),
}))

import { listTask } from './list'

describe(`sandbox list task`, () => {
  let output: string[]
  let errOutput: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    output = []
    errOutput = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      errOutput.push(chunk.toString())
      return true
    })
    vi.spyOn(process, `exit`).mockImplementation(((code?: any) => {
      throw new Error(`__EXIT__${code}`)
    }) as any)

    mockResolveContext.mockResolvedValue({ orgId: `org-1`, projectId: `proj-1` })
    mockGetAlias.mockReturnValue(`my-alias`)
    mockListSandboxes.mockResolvedValue({ data: [], error: undefined })
  })

  const run = async (args: any = {}) => {
    try {
      await listTask.action!({ params: {}, auth: {}, config: {}, ...args } as any)
    } catch (err: any) {
      if (!String(err.message).startsWith(`__EXIT__`)) throw err
    }
  }

  const joined = () => output.join(``)
  const joinedErr = () => errOutput.join(``)

  it(`exits 1 when listSandboxes resolves with an error`, async () => {
    mockListSandboxes.mockResolvedValueOnce({ data: null, error: { message: `boom` } })

    await run()

    expect(joinedErr()).toContain(`Error:`)
    expect(joinedErr()).toContain(`boom`)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it(`outputs "No sandboxes found" and skips saveContext when the list is empty`, async () => {
    mockListSandboxes.mockResolvedValueOnce({ data: [], error: undefined })

    await run({ config: { org: `org-1` } })

    expect(joined()).toContain(`No sandboxes found`)
    expect(mockSaveContext).not.toHaveBeenCalled()
  })

  it(`falls back to "unnamed" when a sandbox has no name`, async () => {
    mockListSandboxes.mockResolvedValueOnce({
      data: [{ id: `sb-1`, name: ``, config: {} }],
      error: undefined,
    })

    await run()

    expect(joined()).toContain(`unnamed`)
  })

  it(`falls back to "-" for alias when getAlias returns falsy`, async () => {
    mockGetAlias.mockReturnValue(``)
    mockListSandboxes.mockResolvedValueOnce({
      data: [{ id: `sb-1`, name: `my-box`, config: {} }],
      error: undefined,
    })

    await run()

    const line = output.find((l) => l.includes(`sb-1`))
    expect(line).toBeTruthy()
    expect(line).toContain(`-`.padEnd(22))
  })

  it(`falls back to "-" for runtime when sb.config.runtimeCommand is falsy`, async () => {
    mockListSandboxes.mockResolvedValueOnce({
      data: [{ id: `sb-1`, name: `my-box`, config: {} }],
      error: undefined,
    })

    await run()

    const line = output.find((l) => l.includes(`sb-1`))
    expect(line).toBeTruthy()
    expect(line).toContain(`-`.padEnd(20))
  })

  it(`truncates a name longer than 20 chars`, async () => {
    const longName = `x`.repeat(30)
    mockListSandboxes.mockResolvedValueOnce({
      data: [{ id: `sb-1`, name: longName, config: {} }],
      error: undefined,
    })

    await run()

    expect(joined()).not.toContain(longName)
    expect(joined()).toContain(`x`.repeat(20))
  })

  it(`calls saveContext with the resolved org/project when config is truthy`, async () => {
    mockListSandboxes.mockResolvedValueOnce({
      data: [{ id: `sb-1`, name: `my-box`, config: {} }],
      error: undefined,
    })

    await run({ config: { org: `org-1` } })

    expect(mockSaveContext).toHaveBeenCalledWith({ org: `org-1` }, `org-1`, `proj-1`)
  })

  it(`does not call saveContext when config is falsy`, async () => {
    mockListSandboxes.mockResolvedValueOnce({
      data: [{ id: `sb-1`, name: `my-box`, config: {} }],
      error: undefined,
    })

    await run({ config: undefined })

    expect(mockSaveContext).not.toHaveBeenCalled()
  })
})
