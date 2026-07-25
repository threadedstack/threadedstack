import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockListThreads = vi.fn()
const mockResolveOrgId = vi.fn()
const mockResolveProjectId = vi.fn()
const mockResolveAgentId = vi.fn()
const mockSaveContext = vi.fn()

vi.mock(`@TSA/utils/tasks/ensureAuth`, () => ({
  ensureAuth: (action: any) => action,
}))

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    listThreads: mockListThreads,
  })),
}))

vi.mock(`@TSA/utils/tasks/resolveOrgId`, () => ({
  resolveOrgId: (...args: any[]) => mockResolveOrgId(...args),
}))

vi.mock(`@TSA/utils/tasks/resolveProjectId`, () => ({
  resolveProjectId: (...args: any[]) => mockResolveProjectId(...args),
}))

vi.mock(`@TSA/utils/tasks/resolveAgentId`, () => ({
  resolveAgentId: (...args: any[]) => mockResolveAgentId(...args),
}))

vi.mock(`@TSA/utils/tasks/saveContext`, () => ({
  saveContext: (...args: any[]) => mockSaveContext(...args),
}))

import { threads } from './threads'

describe(`threads task`, () => {
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

    mockResolveOrgId.mockResolvedValue(`org-1`)
    mockResolveProjectId.mockResolvedValue(`proj-1`)
    mockResolveAgentId.mockResolvedValue(`agent-1`)
    mockListThreads.mockResolvedValue({ data: [], error: undefined })
  })

  const run = async (args: any) => {
    try {
      await threads.action!(args)
    } catch (err: any) {
      if (!String(err.message).startsWith(`__EXIT__`)) throw err
    }
  }

  it(`exits 1 when resolveOrgId rejects, without calling downstream resolvers`, async () => {
    mockResolveOrgId.mockRejectedValueOnce(new Error(`org lookup failed`))

    await run({ params: {}, auth: {}, config: { org: `org-old` }, options: [] })

    expect(errOutput.join(``)).toContain(`org lookup failed`)
    expect(process.exit).toHaveBeenCalledWith(1)
    expect(mockResolveProjectId).not.toHaveBeenCalled()
    expect(mockResolveAgentId).not.toHaveBeenCalled()
    expect(mockSaveContext).not.toHaveBeenCalled()
  })

  it(`passes params.project through to resolveProjectId when org is unchanged`, async () => {
    mockResolveOrgId.mockResolvedValueOnce(`org-1`)

    await run({
      params: { project: `proj-explicit` },
      auth: {},
      config: { org: `org-1` },
      options: [],
    })

    expect(mockResolveProjectId).toHaveBeenCalledWith(
      expect.anything(),
      `org-1`,
      `proj-explicit`
    )
  })

  it(`forces explicitProject to undefined when org changed, even if params.project is set`, async () => {
    mockResolveOrgId.mockResolvedValueOnce(`org-2`)

    await run({
      params: { project: `proj-explicit` },
      auth: {},
      config: { org: `org-1` },
      options: [],
    })

    expect(mockResolveProjectId).toHaveBeenCalledWith(
      expect.anything(),
      `org-2`,
      undefined
    )
  })

  it(`forces config?.agent fallback to undefined when org changed`, async () => {
    mockResolveOrgId.mockResolvedValueOnce(`org-2`)

    await run({
      params: {},
      auth: {},
      config: { org: `org-1`, agent: `agent-old` },
      options: [],
    })

    expect(mockResolveAgentId).toHaveBeenCalledWith(
      expect.anything(),
      `org-2`,
      undefined,
      undefined
    )
  })

  it(`passes config?.agent through to resolveAgentId when org is unchanged`, async () => {
    mockResolveOrgId.mockResolvedValueOnce(`org-1`)

    await run({
      params: {},
      auth: {},
      config: { org: `org-1`, agent: `agent-old` },
      options: [],
    })

    expect(mockResolveAgentId).toHaveBeenCalledWith(
      expect.anything(),
      `org-1`,
      undefined,
      `agent-old`
    )
  })

  it(`exits 1 when listThreads resolves with an error`, async () => {
    mockListThreads.mockResolvedValueOnce({ data: null, error: { message: `boom` } })

    await run({ params: {}, auth: {}, config: { org: `org-1` }, options: [] })

    expect(errOutput.join(``)).toContain(`boom`)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it(`outputs "No threads found" when listThreads resolves empty`, async () => {
    mockListThreads.mockResolvedValueOnce({ data: [], error: undefined })

    await run({ params: {}, auth: {}, config: { org: `org-1` }, options: [] })

    expect(output.join(``)).toContain(`No threads found`)
  })

  it(`falls back to "untitled" for a thread with no name`, async () => {
    mockListThreads.mockResolvedValueOnce({
      data: [{ id: `t-1`, name: `` }],
      error: undefined,
    })

    await run({ params: {}, auth: {}, config: { org: `org-1` }, options: [] })

    expect(output.join(``)).toContain(`t-1`)
    expect(output.join(``)).toContain(`untitled`)
  })

  it(`does not call saveContext when config is falsy`, async () => {
    await run({ params: {}, auth: {}, config: undefined, options: [] })

    expect(mockSaveContext).not.toHaveBeenCalled()
  })
})
