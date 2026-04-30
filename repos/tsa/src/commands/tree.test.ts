import type { TSlashCommandContext } from '@TSA/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { treeCommand } from './tree'

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

describe(`/tree command`, () => {
  it(`should have correct name, aliases, and description`, () => {
    expect(treeCommand.name).toBe(`tree`)
    expect(treeCommand.aliases).toContain(`tr`)
    expect(treeCommand.description).toBeTruthy()
  })

  it(`should output message when no active thread`, async () => {
    const ctx = makeCtx({ threadId: null })
    await treeCommand.handler(``, ctx)
    expect(ctx.output).toHaveBeenCalledWith(
      `No active thread. Send a message first to create one.`
    )
  })

  it(`should call getThreadWithBranches with the current thread ID`, async () => {
    const ctx = makeCtx({
      threadId: `t-root`,
      getThreadWithBranches: vi.fn().mockResolvedValue({
        id: `t-root`,
        name: `Root`,
        branches: [],
      }),
    })

    await treeCommand.handler(``, ctx)

    // findRoot calls getThreadWithBranches first, then fetchTree calls it again
    expect(ctx.getThreadWithBranches).toHaveBeenCalledWith(`t-root`)
  })

  it(`should display single thread when no branches exist`, async () => {
    const ctx = makeCtx({
      threadId: `t-root`,
      getThreadWithBranches: vi.fn().mockResolvedValue({
        id: `t-root`,
        name: `Root Thread`,
        branches: [],
      }),
    })

    await treeCommand.handler(``, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(output).toContain(`Root Thread`)
    expect(output).toContain(`t-root`)
    expect(output).toContain(`<--`)
  })

  it(`should render ASCII tree for root with one branch`, async () => {
    const getThreadWithBranches = vi.fn()
    // findRoot call — root has no parent
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [],
    })
    // fetchTree call for root
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [{ id: `t-branch`, name: `Branch 1`, branchMessageId: `m-5` }],
    })
    // fetchTree call for branch child
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-branch`,
      name: `Branch 1`,
      branches: [],
    })

    const ctx = makeCtx({
      threadId: `t-root`,
      getThreadWithBranches,
    })

    await treeCommand.handler(``, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const lines = output.split(`\n`)

    // Root line
    expect(lines[0]).toContain(`Root`)
    expect(lines[0]).toContain(`t-root`)
    expect(lines[0]).toContain(`<--`)

    // Branch line
    expect(lines[1]).toContain(`Branch 1`)
    expect(lines[1]).toContain(`t-branch`)
    expect(lines[1]).toContain(`at msg m-5`)
  })

  it(`should render multi-level tree (root -> branch -> sub-branch)`, async () => {
    const getThreadWithBranches = vi.fn()
    // findRoot: root has no parent
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [],
    })
    // fetchTree: root
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [{ id: `t-b1`, name: `B1`, branchMessageId: `m-1` }],
    })
    // fetchTree: branch B1
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-b1`,
      name: `B1`,
      branches: [{ id: `t-b2`, name: `B2`, branchMessageId: `m-2` }],
    })
    // fetchTree: sub-branch B2
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-b2`,
      name: `B2`,
      branches: [],
    })

    const ctx = makeCtx({
      threadId: `t-b2`,
      getThreadWithBranches,
    })

    await treeCommand.handler(``, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const lines = output.split(`\n`)

    expect(lines.length).toBe(3)
    // Root: no marker since currentThread is t-b2
    expect(lines[0]).toContain(`Root [t-root]`)
    expect(lines[0]).not.toContain(`<--`)

    // B1
    expect(lines[1]).toContain(`B1`)
    expect(lines[1]).toContain(`t-b1`)
    expect(lines[1]).not.toContain(`<--`)

    // B2 is current thread
    expect(lines[2]).toContain(`B2`)
    expect(lines[2]).toContain(`t-b2`)
    expect(lines[2]).toContain(`<--`)
  })

  it(`should mark current thread with <-- marker`, async () => {
    const getThreadWithBranches = vi.fn()
    // findRoot
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [],
    })
    // fetchTree: root with two branches
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [
        { id: `t-b1`, name: `B1`, branchMessageId: `m-1` },
        { id: `t-b2`, name: `B2`, branchMessageId: `m-2` },
      ],
    })
    // fetchTree: B1 (no children)
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-b1`,
      name: `B1`,
      branches: [],
    })
    // fetchTree: B2 (no children)
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-b2`,
      name: `B2`,
      branches: [],
    })

    const ctx = makeCtx({
      threadId: `t-b1`,
      getThreadWithBranches,
    })

    await treeCommand.handler(``, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const lines = output.split(`\n`)

    // Only t-b1 should have the marker
    const b1Line = lines.find((l) => l.includes(`t-b1`))
    const b2Line = lines.find((l) => l.includes(`t-b2`))
    const rootLine = lines.find((l) => l.includes(`t-root`))

    expect(b1Line).toContain(`<--`)
    expect(b2Line).not.toContain(`<--`)
    expect(rootLine).not.toContain(`<--`)
  })

  it(`should walk up parent links to find root`, async () => {
    const getThreadWithBranches = vi.fn()
    // findRoot: first call for t-child — has parentThread
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-child`,
      name: `Child`,
      parentThreadId: `t-root`,
      parentThread: { id: `t-root`, name: `Root` },
      branches: [],
    })
    // findRoot: second call for t-root — no parent
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [],
    })
    // fetchTree: root
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-root`,
      name: `Root`,
      branches: [{ id: `t-child`, name: `Child`, branchMessageId: `m-1` }],
    })
    // fetchTree: child
    getThreadWithBranches.mockResolvedValueOnce({
      id: `t-child`,
      name: `Child`,
      branches: [],
    })

    const ctx = makeCtx({
      threadId: `t-child`,
      getThreadWithBranches,
    })

    await treeCommand.handler(``, ctx)

    const output = (ctx.output as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(output).toContain(`Root [t-root]`)
    expect(output).toContain(`Child`)
    expect(output).toContain(`<--`)
  })

  it(`should output error message when getThreadWithBranches fails`, async () => {
    const ctx = makeCtx({
      threadId: `t-1`,
      getThreadWithBranches: vi.fn().mockRejectedValue(new Error(`Network error`)),
    })

    await treeCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error building thread tree: Network error`)
  })
})
