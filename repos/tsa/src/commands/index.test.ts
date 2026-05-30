import type { TSlashCommandContext } from '@TSA/types'

import { infoCommand } from './info'
import { clearCommand } from './clear'
import { projectsCommand } from './projects'
import { AgentsEnabled } from '@TSA/constants/values'
import { describe, it, expect, vi } from 'vitest'
import { switchAgentCommand } from './switchAgent'
import { listThreadsCommand } from './listThreads'
import { parseCommand, findCommand, commands } from './index'

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
  branchThread: vi.fn().mockResolvedValue({ id: `t-branch` }),
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

describe(`Command Registry`, () => {
  it(`parseCommand extracts command name and args`, () => {
    const { name, args } = parseCommand(`/switch 3`)
    expect(name).toBe(`switch`)
    expect(args).toBe(`3`)
  })

  it(`parseCommand handles command with no args`, () => {
    const { name, args } = parseCommand(`/help`)
    expect(name).toBe(`help`)
    expect(args).toBe(``)
  })

  it(`findCommand finds by name`, () => {
    const cmd = findCommand(`help`)
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe(`help`)
  })

  it(`findCommand finds by alias`, () => {
    const cmd = findCommand(`h`)
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe(`help`)
  })

  it(`findCommand returns null for unknown command`, () => {
    const cmd = findCommand(`unknown`)
    expect(cmd).toBeNull()
  })

  it(`all commands have name, aliases, description, and handler`, () => {
    for (const cmd of commands) {
      expect(cmd.name).toBeTruthy()
      expect(Array.isArray(cmd.aliases)).toBe(true)
      expect(cmd.description).toBeTruthy()
      expect(typeof cmd.handler).toBe(`function`)
    }
  })

  it(`findCommand finds /projects by name`, () => {
    const cmd = findCommand(`projects`)
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe(`projects`)
  })

  it(`findCommand finds /projects by alias "proj"`, () => {
    const cmd = findCommand(`proj`)
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe(`projects`)
  })
})

describe(`/projects command`, () => {
  it(`calls switchProject to trigger phase-based project picker`, async () => {
    const ctx = makeCtx()

    await projectsCommand.handler(``, ctx)

    expect(ctx.switchProject).toHaveBeenCalled()
  })
})

describe.skipIf(!AgentsEnabled)(`/agent command`, () => {
  it(`sets agentId directly when args provided`, async () => {
    const ctx = makeCtx()

    await switchAgentCommand.handler(`agent-xyz`, ctx)

    expect(ctx.setAgentId).toHaveBeenCalledWith(`agent-xyz`)
    expect(ctx.setThreadId).toHaveBeenCalledWith(null)
    expect(ctx.clearMessages).toHaveBeenCalled()
    expect(ctx.showMenu).not.toHaveBeenCalled()
  })

  it(`calls listAgents and showMenu when no args`, async () => {
    const items = [{ id: `a1`, label: `Bot`, description: `Helper` }]
    const ctx = makeCtx({
      listAgents: vi.fn().mockResolvedValue(items),
    })

    await switchAgentCommand.handler(``, ctx)

    expect(ctx.listAgents).toHaveBeenCalled()
    expect(ctx.showMenu).toHaveBeenCalledWith(
      expect.stringContaining(`Select an agent`),
      items,
      expect.any(Function)
    )
  })

  it(`outputs message when no agents found`, async () => {
    const ctx = makeCtx({
      listAgents: vi.fn().mockResolvedValue([]),
    })

    await switchAgentCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`No agents found.`)
  })
})

describe.skipIf(!AgentsEnabled)(`/threads command`, () => {
  it(`calls showMenu with thread items`, async () => {
    const threads = [
      { id: `t1`, name: `Chat 1`, createdAt: `2026-01-01` },
      { id: `t2`, name: `Chat 2` },
    ]
    const ctx = makeCtx({
      listThreads: vi.fn().mockResolvedValue(threads),
    })

    await listThreadsCommand.handler(``, ctx)

    expect(ctx.showMenu).toHaveBeenCalledWith(
      expect.stringContaining(`Select a thread`),
      expect.arrayContaining([
        expect.objectContaining({ id: `t1`, label: `Chat 1` }),
        expect.objectContaining({ id: `t2`, label: `Chat 2` }),
      ]),
      expect.any(Function),
      expect.objectContaining({ onAction: expect.any(Function) })
    )
  })

  it(`outputs message when no threads found`, async () => {
    const ctx = makeCtx({
      listThreads: vi.fn().mockResolvedValue([]),
    })

    await listThreadsCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`No threads found.`)
    expect(ctx.showMenu).not.toHaveBeenCalled()
  })
})

describe(`/clear command`, () => {
  it(`clears messages and creates new thread`, async () => {
    const ctx = makeCtx({
      createThread: vi.fn().mockResolvedValue({ id: `t-new` }),
    })

    await clearCommand.handler(``, ctx)

    expect(ctx.clearMessages).toHaveBeenCalled()
    expect(ctx.createThread).toHaveBeenCalled()
    expect(ctx.setThreadId).toHaveBeenCalledWith(`t-new`)
  })

  it(`sets threadId to null when createThread fails`, async () => {
    const ctx = makeCtx({
      createThread: vi.fn().mockRejectedValue(new Error(`fail`)),
    })

    await clearCommand.handler(``, ctx)

    expect(ctx.clearMessages).toHaveBeenCalled()
    expect(ctx.setThreadId).toHaveBeenCalledWith(null)
  })
})

describe(`/info command with dynamic state (getter)`, () => {
  it(`messages getter reflects live message count`, async () => {
    let msgs: any[] = [{ type: `user`, content: `hello` }]
    const ctx = makeCtx()
    // Replace static property with getter
    Object.defineProperty(ctx, `messages`, { get: () => msgs, configurable: true })

    await infoCommand.handler(``, ctx)
    expect(ctx.output).toHaveBeenCalledWith(expect.stringContaining(`Messages: 1`))

    // Simulate thread switch — messages cleared
    msgs = []
    ;(ctx.output as ReturnType<typeof vi.fn>).mockClear()
    await infoCommand.handler(``, ctx)
    expect(ctx.output).toHaveBeenCalledWith(expect.stringContaining(`Messages: 0`))
  })

  it(`contextFiles getter reflects live file count`, async () => {
    let files: any[] = [
      { path: `/a`, name: `a`, source: `manual`, content: ``, sizeBytes: 0 },
    ]
    const ctx = makeCtx()
    // Replace static property with getter
    Object.defineProperty(ctx, `contextFiles`, { get: () => files, configurable: true })

    await infoCommand.handler(``, ctx)
    expect(ctx.output).toHaveBeenCalledWith(expect.stringContaining(`Context files: 1`))

    // Remove file
    files = []
    ;(ctx.output as ReturnType<typeof vi.fn>).mockClear()
    await infoCommand.handler(``, ctx)
    expect(ctx.output).toHaveBeenCalledWith(expect.stringContaining(`Context files: 0`))
  })
})
