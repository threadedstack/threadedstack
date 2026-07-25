import type { TSlashCommandContext } from '@TSA/types'

import { portsCommand } from './ports'
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

describe(`/ports command`, () => {
  it(`empty args defaults to list, calls ctx.output with the list hint`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(``, ctx)

    expect(result).toBeUndefined()
    expect(ctx.output).toHaveBeenCalledWith(
      `Use tsa ports list from the CLI to list ports.`
    )
  })

  it(`ls alias behaves the same as list`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`ls`, ctx)

    expect(result).toBeUndefined()
    expect(ctx.output).toHaveBeenCalledWith(
      `Use tsa ports list from the CLI to list ports.`
    )
  })

  it(`add <port> calls ctx.output with the add hint containing the port`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`add 8080`, ctx)

    expect(result).toBeUndefined()
    expect(ctx.output).toHaveBeenCalledWith(
      `Use \`tsa ports add 8080\` from the CLI to expose port 8080.`
    )
  })

  it(`add with no port returns the add usage string, ctx.output NOT called`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`add`, ctx)

    expect(result).toBe(`Usage: /ports add <port>`)
    expect(ctx.output).not.toHaveBeenCalled()
  })

  it(`add abc (non-numeric) returns the add usage string`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`add abc`, ctx)

    expect(result).toBe(`Usage: /ports add <port>`)
    expect(ctx.output).not.toHaveBeenCalled()
  })

  it(`expose alias behaves like add`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`expose 3000`, ctx)

    expect(result).toBeUndefined()
    expect(ctx.output).toHaveBeenCalledWith(
      `Use \`tsa ports add 3000\` from the CLI to expose port 3000.`
    )
  })

  it(`remove <port> calls ctx.output with the remove hint`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`remove 3000`, ctx)

    expect(result).toBeUndefined()
    expect(ctx.output).toHaveBeenCalledWith(
      `Use \`tsa ports remove 3000\` from the CLI to remove port 3000.`
    )
  })

  it(`rm alias behaves like remove`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`rm 3000`, ctx)

    expect(result).toBeUndefined()
    expect(ctx.output).toHaveBeenCalledWith(
      `Use \`tsa ports remove 3000\` from the CLI to remove port 3000.`
    )
  })

  it(`remove with invalid port returns the remove usage string`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`remove`, ctx)

    expect(result).toBe(`Usage: /ports remove <port>`)
    expect(ctx.output).not.toHaveBeenCalled()
  })

  it(`open <port> calls ctx.output with the open hint`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`open 5000`, ctx)

    expect(result).toBeUndefined()
    expect(ctx.output).toHaveBeenCalledWith(
      `Use \`tsa ports open 5000\` from the CLI to get the port URL.`
    )
  })

  it(`open with invalid port returns the open usage string`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`open`, ctx)

    expect(result).toBe(`Usage: /ports open <port>`)
    expect(ctx.output).not.toHaveBeenCalled()
  })

  it(`unrecognized sub returns the full multi-option usage string`, async () => {
    const ctx = makeCtx()

    const result = await portsCommand.handler(`foo`, ctx)

    expect(result).toBe(`Usage: /ports [list|add <port>|remove <port>|open <port>]`)
    expect(ctx.output).not.toHaveBeenCalled()
  })
})
