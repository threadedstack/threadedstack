import type { TSlashCommandContext } from '@TSA/types'

import { forkCommand } from './fork'
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

describe.skipIf(!AgentsEnabled)(`/fork command`, () => {
  it(`should have correct name, aliases, and description`, () => {
    expect(forkCommand.name).toBe(`fork`)
    expect(forkCommand.aliases).toContain(`br`)
    expect(forkCommand.description).toBeTruthy()
  })

  it(`should output message when no active thread`, async () => {
    const ctx = makeCtx({ threadId: null })
    await forkCommand.handler(`m-123`, ctx)
    expect(ctx.output).toHaveBeenCalledWith(
      `No active thread. Send a message first to create one.`
    )
  })

  it(`should output no-messages error when no messageId and no messages`, async () => {
    const ctx = makeCtx({ threadId: `t-1`, messages: [] })
    await forkCommand.handler(``, ctx)
    expect(ctx.output).toHaveBeenCalledWith(
      `No messages in current thread. Cannot determine branch point.`
    )
  })

  it(`should show usage when no messageId but messages exist`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      messages: [{ type: `user`, content: `hello` }],
    })
    await forkCommand.handler(``, ctx)
    expect(ctx.output).toHaveBeenCalledWith(
      expect.stringContaining(`Usage: /fork <messageId>`)
    )
  })

  it(`should call branchThread with correct threadId and messageId`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      branchThread: vi.fn().mockResolvedValue({ id: `t-new-branch`, name: `My Branch` }),
    })

    await forkCommand.handler(`m-42`, ctx)

    expect(ctx.branchThread).toHaveBeenCalledWith(`t-1`, `m-42`)
  })

  it(`should print the new thread ID on success`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      branchThread: vi.fn().mockResolvedValue({ id: `t-new-branch`, name: `My Branch` }),
    })

    await forkCommand.handler(`m-42`, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(output).toContain(`t-new-branch`)
    expect(output).toContain(`My Branch`)
    expect(output).toContain(`m-42`)
  })

  it(`should suggest /switch to the new branch`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      branchThread: vi.fn().mockResolvedValue({ id: `t-new-branch`, name: `My Branch` }),
    })

    await forkCommand.handler(`m-42`, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(output).toContain(`/switch t-new-branch`)
  })

  it(`should use result.id when name is not set`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      branchThread: vi.fn().mockResolvedValue({ id: `t-abc` }),
    })

    await forkCommand.handler(`m-10`, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(output).toContain(`t-abc`)
  })

  it(`should output error when branchThread fails`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      branchThread: vi.fn().mockRejectedValue(new Error(`Branch message not found`)),
    })

    await forkCommand.handler(`m-invalid`, ctx)

    expect(ctx.output).toHaveBeenCalledWith(
      `Error branching thread: Branch message not found`
    )
  })

  it(`should output error for non-Error rejections`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      branchThread: vi.fn().mockRejectedValue(`something went wrong`),
    })

    await forkCommand.handler(`m-1`, ctx)

    expect(ctx.output).toHaveBeenCalledWith(
      `Error branching thread: something went wrong`
    )
  })

  it(`should trim whitespace from messageId arg`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      branchThread: vi.fn().mockResolvedValue({ id: `t-branch` }),
    })

    await forkCommand.handler(`  m-42  `, ctx)

    expect(ctx.branchThread).toHaveBeenCalledWith(`t-1`, `m-42`)
  })
})
