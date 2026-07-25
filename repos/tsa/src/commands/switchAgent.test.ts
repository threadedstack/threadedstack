import type { TSlashCommandContext } from '@TSA/types'

import { switchAgentCommand } from './switchAgent'
import { describe, it, expect, vi } from 'vitest'

const makeCtx = (
  overrides: Partial<TSlashCommandContext> = {}
): TSlashCommandContext => ({
  orgId: `org1`,
  agentId: `agent1`,
  threadId: null,
  projectId: null,
  verbose: false,
  connection: `connected`,
  exit: vi.fn(),
  output: vi.fn(),
  clearMessages: vi.fn(),
  setAgentId: vi.fn(),
  setThreadId: vi.fn(),
  setProjectId: vi.fn(),
  setProviderId: vi.fn(),
  setVerbose: vi.fn(),
  addContextFile: vi.fn(),
  removeContextFile: vi.fn(),
  messages: [],
  contextFiles: [],
  listThreads: vi.fn().mockResolvedValue([]),
  switchProject: vi.fn().mockResolvedValue(undefined),
  listProjects: vi.fn().mockResolvedValue([]),
  listAgents: vi.fn().mockResolvedValue([]),
  deleteThread: vi.fn().mockResolvedValue(undefined),
  createThread: vi.fn().mockResolvedValue({ id: `t-new` }),
  loadThreadMessages: vi.fn().mockResolvedValue(undefined),
  getThreadWithBranches: vi.fn().mockResolvedValue({ id: `t1`, branches: [] }),
  branchThread: vi.fn().mockResolvedValue({ id: `t-branch`, name: `Branch` }),
  showMenu: vi.fn(),
  closeMenu: vi.fn(),
  auth: {
    loggedIn: true,
    proxyUrl: `https://px.local.threadedstack.app`,
    logout: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    loginWithToken: vi.fn().mockResolvedValue(undefined),
  },
  ...overrides,
})

describe(`/agent command`, () => {
  it(`should have correct name, aliases, and description`, () => {
    expect(switchAgentCommand.name).toBe(`agent`)
    expect(switchAgentCommand.aliases).toContain(`a`)
    expect(switchAgentCommand.description).toBeTruthy()
  })

  it(`should switch directly to the given agent id when args are provided`, async () => {
    const ctx = makeCtx()

    await switchAgentCommand.handler(`agent-42`, ctx)

    expect(ctx.setAgentId).toHaveBeenCalledWith(`agent-42`)
    expect(ctx.setThreadId).toHaveBeenCalledWith(null)
    expect(ctx.clearMessages).toHaveBeenCalled()
    expect(ctx.output).toHaveBeenCalledWith(`Switched to agent agent-42`)
    expect(ctx.listAgents).not.toHaveBeenCalled()
    expect(ctx.showMenu).not.toHaveBeenCalled()
  })

  it(`should trim whitespace from the provided agent id`, async () => {
    const ctx = makeCtx()

    await switchAgentCommand.handler(`  agent-42  `, ctx)

    expect(ctx.setAgentId).toHaveBeenCalledWith(`agent-42`)
    expect(ctx.output).toHaveBeenCalledWith(`Switched to agent agent-42`)
  })

  it(`should output no-agents message when args are empty and listAgents resolves empty`, async () => {
    const ctx = makeCtx({ listAgents: vi.fn().mockResolvedValue([]) })

    await switchAgentCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`No agents found.`)
    expect(ctx.showMenu).not.toHaveBeenCalled()
  })

  it(`should show the plain prompt when projectId is not set`, async () => {
    const items = [{ id: `a-1`, label: `Agent One` }]
    const ctx = makeCtx({
      projectId: null,
      listAgents: vi.fn().mockResolvedValue(items),
    })

    await switchAgentCommand.handler(``, ctx)

    expect(ctx.showMenu).toHaveBeenCalledWith(
      `Select an agent:`,
      items,
      expect.any(Function)
    )
  })

  it(`should show the project-scoped prompt when projectId is set`, async () => {
    const items = [{ id: `a-1`, label: `Agent One` }]
    const ctx = makeCtx({
      projectId: `proj-9`,
      listAgents: vi.fn().mockResolvedValue(items),
    })

    await switchAgentCommand.handler(``, ctx)

    expect(ctx.showMenu).toHaveBeenCalledWith(
      `Select an agent (project: proj-9):`,
      items,
      expect.any(Function)
    )
  })

  it(`should switch agent via the onSelect callback passed to showMenu`, async () => {
    const items = [{ id: `a-1`, label: `Agent One` }]
    const ctx = makeCtx({
      listAgents: vi.fn().mockResolvedValue(items),
    })

    await switchAgentCommand.handler(``, ctx)

    const onSelect = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[0][2] as (
      item: (typeof items)[0]
    ) => void
    onSelect(items[0])

    expect(ctx.setAgentId).toHaveBeenCalledWith(`a-1`)
    expect(ctx.setThreadId).toHaveBeenCalledWith(null)
    expect(ctx.clearMessages).toHaveBeenCalled()
    expect(ctx.output).toHaveBeenCalledWith(`Switched to agent Agent One`)
  })
})
