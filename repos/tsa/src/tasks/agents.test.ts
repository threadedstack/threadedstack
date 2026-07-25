import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TSA/theme`, () => ({
  themed: (_color: string, text: string) => text,
}))

vi.mock(`@TSA/utils/tasks/ensureAuth`, () => ({
  ensureAuth: (action: (...args: any[]) => any) => action,
}))

const resolveOrgId = vi.fn()
vi.mock(`@TSA/utils/tasks/resolveOrgId`, () => ({
  resolveOrgId: (...args: any[]) => resolveOrgId(...args),
}))

const listAgents = vi.fn()
vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    listAgents,
  })),
}))

import { agents } from './agents'

describe(`agents task`, () => {
  let output: string[]
  let errOutput: string[]
  let exitCode: number | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    output = []
    errOutput = []
    exitCode = undefined
    resolveOrgId.mockResolvedValue(`org-1`)
    listAgents.mockResolvedValue({ data: [], error: undefined })
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      errOutput.push(String(chunk))
      return true
    })
    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code ?? 0
      throw new Error(`__EXIT__`)
    })
  })

  const joined = () => output.join(``)
  const joinedErr = () => errOutput.join(``)

  const runAction = async (args: any = {}) => {
    try {
      await agents.action!({ auth: {}, params: {}, config: {}, ...args } as any)
    } catch (err: any) {
      if (err.message !== `__EXIT__`) throw err
    }
  }

  it(`lists agents, formatting the model suffix only when a model is present`, async () => {
    listAgents.mockResolvedValue({
      data: [
        { id: `a1`, name: `Agent One`, model: `gpt-4` },
        { id: `a2`, name: `Agent Two` },
      ],
      error: undefined,
    })

    await runAction()

    expect(joined()).toContain(`Agents:`)
    expect(joined()).toContain(`a1 Agent One (gpt-4)`)
    expect(joined()).toContain(`a2 Agent Two`)
    expect(joined()).not.toContain(`Agent Two (`)
    expect(process.exit).not.toHaveBeenCalled()
  })

  it(`outputs a no-agents message and skips the header when the list is empty`, async () => {
    listAgents.mockResolvedValue({ data: [], error: undefined })

    await runAction()

    expect(joined()).toContain(`No agents found`)
    expect(joined()).not.toContain(`Agents:`)
    expect(process.exit).not.toHaveBeenCalled()
  })

  it(`writes an error to stderr and exits when resolveOrgId rejects`, async () => {
    resolveOrgId.mockRejectedValue(new Error(`no orgs found`))

    await runAction()

    expect(joinedErr()).toContain(`Error:`)
    expect(joinedErr()).toContain(`no orgs found`)
    expect(exitCode).toBe(1)
  })

  it(`writes the error message to stdout and exits when listAgents returns an error`, async () => {
    listAgents.mockResolvedValue({
      data: undefined,
      error: { message: `not authorized` },
    })

    await runAction()

    expect(joined()).toContain(`Error:`)
    expect(joined()).toContain(`not authorized`)
    expect(exitCode).toBe(1)
  })

  it(`falls back to a generic failure message when listAgents returns no error and no data`, async () => {
    listAgents.mockResolvedValue({ data: undefined, error: undefined })

    await runAction()

    expect(joined()).toContain(`Failed to list agents`)
    expect(exitCode).toBe(1)
  })

  it(`passes the explicit org param and config org through to resolveOrgId`, async () => {
    await runAction({ params: { org: `org-explicit` }, config: { org: `org-config` } })

    expect(resolveOrgId).toHaveBeenCalledWith(
      expect.anything(),
      `org-explicit`,
      `org-config`
    )
  })
})
