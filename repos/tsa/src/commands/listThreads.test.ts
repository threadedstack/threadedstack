import type { TSlashCommandContext } from '@TSA/types'

import { listThreadsCommand } from './listThreads'
import { AgentsEnabled } from '@TSA/constants/values'
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

describe.skipIf(!AgentsEnabled)(`/threads command`, () => {
  it(`should have correct name, aliases, and description`, () => {
    expect(listThreadsCommand.name).toBe(`threads`)
    expect(listThreadsCommand.aliases).toContain(`t`)
    expect(listThreadsCommand.description).toBeTruthy()
  })

  it(`should output no-threads message and not show a menu when the list is empty`, async () => {
    const ctx = makeCtx({ listThreads: vi.fn().mockResolvedValue([]) })

    await listThreadsCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`No threads found.`)
    expect(ctx.showMenu).not.toHaveBeenCalled()
  })

  it(`should build menu items with a slice-of-id label and undefined description when name/createdAt are absent`, async () => {
    const ctx = makeCtx({
      listThreads: vi.fn().mockResolvedValue([{ id: `abcdefghij` }]),
    })

    await listThreadsCommand.handler(``, ctx)

    const items = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(items).toEqual([
      { id: `abcdefghij`, label: `abcdefgh`, description: undefined },
    ])
  })

  it(`should build menu items with the thread name and a created-at description when present`, async () => {
    const ctx = makeCtx({
      listThreads: vi
        .fn()
        .mockResolvedValue([{ id: `t-1`, name: `My Thread`, createdAt: `2026-01-01` }]),
    })

    await listThreadsCommand.handler(``, ctx)

    const items = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(items).toEqual([
      { id: `t-1`, label: `My Thread`, description: `created 2026-01-01` },
    ])
  })

  it(`should load the selected thread and output a loaded message once loadThreadMessages resolves`, async () => {
    const ctx = makeCtx({
      listThreads: vi.fn().mockResolvedValue([{ id: `t-1`, name: `My Thread` }]),
    })

    await listThreadsCommand.handler(``, ctx)

    const onSelect = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[0][2]
    onSelect({ id: `t-1`, label: `My Thread` })

    expect(ctx.setThreadId).toHaveBeenCalledWith(`t-1`)
    expect(ctx.clearMessages).toHaveBeenCalled()
    expect(ctx.loadThreadMessages).toHaveBeenCalledWith(`t-1`)

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(ctx.output).toHaveBeenCalledWith(`Loaded thread My Thread`)
  })

  it(`should delete the thread and refresh the list when the delete confirmation is "yes"`, async () => {
    const ctx = makeCtx({
      listThreads: vi.fn().mockResolvedValue([{ id: `t-1`, name: `My Thread` }]),
    })

    await listThreadsCommand.handler(``, ctx)

    const onAction = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[0][3].onAction
    onAction({ id: `t-1`, label: `My Thread` })

    const confirmCallback = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[1][2]
    await confirmCallback({ id: `yes`, label: `Yes, delete` })

    expect(ctx.deleteThread).toHaveBeenCalledWith(`t-1`)
    expect(ctx.output).toHaveBeenCalledWith(`Deleted thread My Thread`)
    expect(ctx.listThreads).toHaveBeenCalledTimes(2)
  })

  it(`should not delete the thread when the delete confirmation is "no"`, async () => {
    const ctx = makeCtx({
      listThreads: vi.fn().mockResolvedValue([{ id: `t-1`, name: `My Thread` }]),
    })

    await listThreadsCommand.handler(``, ctx)

    const onAction = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[0][3].onAction
    onAction({ id: `t-1`, label: `My Thread` })

    const confirmCallback = (ctx.showMenu as ReturnType<typeof vi.fn>).mock.calls[1][2]
    await confirmCallback({ id: `no`, label: `Cancel` })

    expect(ctx.deleteThread).not.toHaveBeenCalled()
    expect(ctx.listThreads).toHaveBeenCalledTimes(1)
  })

  it(`should output an error message when listThreads rejects with an Error`, async () => {
    const ctx = makeCtx({
      listThreads: vi.fn().mockRejectedValue(new Error(`Network error`)),
    })

    await listThreadsCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error listing threads: Network error`)
    expect(ctx.showMenu).not.toHaveBeenCalled()
  })

  it(`should fall back to String(err) when listThreads rejects with a non-Error`, async () => {
    const ctx = makeCtx({
      listThreads: vi.fn().mockRejectedValue(`something went wrong`),
    })

    await listThreadsCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error listing threads: something went wrong`)
  })
})
