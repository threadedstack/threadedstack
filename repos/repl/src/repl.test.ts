import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInterface } from 'node:readline'

vi.mock(`node:readline`, () => ({
  createInterface: vi.fn(),
}))

import { AgentRepl } from './repl'
import type { LocalAgentExecutor } from '@TRL/executor'

function makeExecutor(
  overrides?: Partial<{
    listOrgs: any[]
    getOrg: any
    listAgents: any[]
    getAgent: any
    listThreads: any[]
    listMessages: any[]
    runResult: any
  }>
) {
  const {
    listOrgs = [{ id: `org1`, name: `TestOrg` }],
    getOrg = { id: `org1`, name: `TestOrg` },
    listAgents = [{ id: `a1`, name: `TestBot` }],
    getAgent = { id: `a1`, name: `TestBot` },
    listThreads = [],
    listMessages = [],
    runResult = { threadId: `t-new` },
  } = overrides || {}

  const client = {
    listOrgs: vi.fn().mockResolvedValue(listOrgs),
    getOrg: vi.fn().mockResolvedValue(getOrg),
    listAgents: vi.fn().mockResolvedValue(listAgents),
    getAgent: vi.fn().mockResolvedValue(getAgent),
    listThreads: vi.fn().mockResolvedValue(listThreads),
    listMessages: vi.fn().mockResolvedValue(listMessages),
  }

  return {
    client,
    run: vi.fn().mockResolvedValue(runResult),
  } as unknown as LocalAgentExecutor & { run: ReturnType<typeof vi.fn> }
}

function makeRenderer() {
  return {
    renderWelcome: vi.fn(),
    renderInfo: vi.fn(),
    renderSuccess: vi.fn(),
    renderWarning: vi.fn(),
    renderError: vi.fn(),
    renderEvent: vi.fn(),
    clear: vi.fn(),
    spinner: vi.fn(() => ({ stop: vi.fn() })),
  }
}

/**
 * Creates a mock readline that yields the given lines then closes.
 * Supports both `for await (const line of rl)` and `.question()`.
 */
function setupMockReadline(lines: string[], questionAnswers: string[] = []) {
  const answerQueue = [...questionAnswers]
  let callCount = 0

  vi.mocked(createInterface).mockImplementation(() => {
    callCount++

    const mockRl: any = {
      prompt: vi.fn(),
      close: vi.fn(),
      question: vi.fn((_q: string, cb: (answer: string) => void) => {
        cb(answerQueue.shift() || ``)
      }),
      [Symbol.asyncIterator]: async function* () {
        for (const line of lines) yield line
      },
    }

    return mockRl
  })
}

describe(`AgentRepl`, () => {
  let output: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    output = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
  })

  const joined = () => output.join(``)

  describe(`start`, () => {
    it(`should set up context and show welcome`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(executor.client.getOrg).toHaveBeenCalledWith(`org1`)
      expect(executor.client.getAgent).toHaveBeenCalledWith(`org1`, `a1`)
      expect(renderer.renderWelcome).toHaveBeenCalledWith(`TestBot`, undefined)
    })

    it(`should auto-select single org`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start()

      expect(executor.client.listOrgs).toHaveBeenCalled()
      expect(executor.client.getOrg).toHaveBeenCalledWith(`org1`)
    })

    it(`should auto-select single agent`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1` })

      expect(executor.client.listAgents).toHaveBeenCalledWith(`org1`)
      expect(executor.client.getAgent).toHaveBeenCalledWith(`org1`, `a1`)
    })

    it(`should show history when threadId provided`, async () => {
      const executor = makeExecutor({
        listMessages: [
          { role: `user`, content: [{ type: `text`, text: `Hello` }] },
          { role: `assistant`, content: [{ type: `text`, text: `Hi!` }] },
        ],
      })
      const renderer = makeRenderer()
      setupMockReadline([`/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1`, threadId: `t1` })

      expect(executor.client.listMessages).toHaveBeenCalledWith(`org1`, `a1`, `t1`)
      expect(joined()).toContain(`History`)
      expect(joined()).toContain(`Hello`)
      expect(joined()).toContain(`Hi!`)
    })

    it(`should return early when no orgs found`, async () => {
      const executor = makeExecutor({ listOrgs: [] })
      const renderer = makeRenderer()
      setupMockReadline([])

      const repl = new AgentRepl(executor, renderer)
      await repl.start()

      expect(renderer.renderWarning).toHaveBeenCalledWith(`No organizations found`)
    })

    it(`should return early when no agents found`, async () => {
      const executor = makeExecutor({ listAgents: [] })
      const renderer = makeRenderer()
      setupMockReadline([])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1` })

      expect(renderer.renderWarning).toHaveBeenCalledWith(
        `No agents found in this organization`
      )
    })
  })

  describe(`slash commands`, () => {
    it(`/exit should stop the loop`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderInfo).toHaveBeenCalledWith(`Goodbye!`)
    })

    it(`/quit should stop the loop`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/quit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderInfo).toHaveBeenCalledWith(`Goodbye!`)
    })

    it(`/q should stop the loop`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/q`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderInfo).toHaveBeenCalledWith(`Goodbye!`)
    })

    it(`/help should show commands`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/help`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(joined()).toContain(`Commands:`)
      expect(joined()).toContain(`/help`)
      expect(joined()).toContain(`/new`)
      expect(joined()).toContain(`/threads`)
      expect(joined()).toContain(`/switch`)
      expect(joined()).toContain(`/history`)
      expect(joined()).toContain(`/agent`)
      expect(joined()).toContain(`/info`)
      expect(joined()).toContain(`/exit`)
    })

    it(`/h should also show help`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/h`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(joined()).toContain(`Commands:`)
    })

    it(`/new should reset thread and show success`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/new`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1`, threadId: `t1` })

      expect(renderer.renderSuccess).toHaveBeenCalledWith(`Started new thread`)
    })

    it(`/info should show session info`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/info`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1`, threadId: `t1` })

      expect(joined()).toContain(`Session Info:`)
      expect(joined()).toContain(`TestOrg`)
      expect(joined()).toContain(`TestBot`)
      expect(joined()).toContain(`t1`)
    })

    it(`/info should show 'new' when no thread`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/info`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(joined()).toContain(`new`)
    })

    it(`/threads should list threads`, async () => {
      const executor = makeExecutor({
        listThreads: [
          { id: `t1`, name: `First chat` },
          { id: `t2`, name: `Second chat` },
        ],
      })
      const renderer = makeRenderer()
      setupMockReadline([`/threads`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(joined()).toContain(`Threads:`)
      expect(joined()).toContain(`First chat`)
      expect(joined()).toContain(`Second chat`)
    })

    it(`/threads should show active marker`, async () => {
      const executor = makeExecutor({
        listThreads: [
          { id: `t1`, name: `Active thread` },
          { id: `t2`, name: `Other thread` },
        ],
      })
      const renderer = makeRenderer()
      setupMockReadline([`/threads`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1`, threadId: `t1` })

      // The active thread should have the ◀ marker
      const text = joined()
      // t1 line should have the marker, t2 should not
      // t1.slice(0, 8) is used for display
      expect(text).toContain(`◀`)
    })

    it(`/threads should show no threads found`, async () => {
      const executor = makeExecutor({ listThreads: [] })
      const renderer = makeRenderer()
      setupMockReadline([`/threads`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderInfo).toHaveBeenCalledWith(`No threads found`)
    })

    it(`/switch should change thread and show history`, async () => {
      const executor = makeExecutor({
        listMessages: [{ role: `user`, content: [{ type: `text`, text: `Prev msg` }] }],
      })
      const renderer = makeRenderer()
      setupMockReadline([`/switch t-new`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderSuccess).toHaveBeenCalledWith(`Switched to thread t-new`)
      expect(executor.client.listMessages).toHaveBeenCalledWith(`org1`, `a1`, `t-new`)
    })

    it(`/switch without args should show warning`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/switch`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderWarning).toHaveBeenCalledWith(`Usage: /switch <thread-id>`)
    })

    it(`/history should show thread messages`, async () => {
      const executor = makeExecutor({
        listMessages: [
          { role: `user`, content: [{ type: `text`, text: `Hello` }] },
          { role: `assistant`, content: [{ type: `text`, text: `World` }] },
        ],
      })
      const renderer = makeRenderer()
      setupMockReadline([`/history`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1`, threadId: `t1` })

      // History is shown twice: once on start (threadId provided) and once for /history command
      expect(joined()).toContain(`History`)
      expect(joined()).toContain(`Hello`)
      expect(joined()).toContain(`World`)
    })

    it(`/history should show info when no active thread`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/history`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderInfo).toHaveBeenCalledWith(`No active thread`)
    })

    it(`unknown command should show warning`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`/foobar`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderWarning).toHaveBeenCalledWith(
        expect.stringContaining(`Unknown command: /foobar`)
      )
    })

    it(`empty input should be ignored`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([``, `   `, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(executor.run).not.toHaveBeenCalled()
    })
  })

  describe(`message handling`, () => {
    it(`should call executor.run with correct args`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`hello world`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(executor.run).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: `org1`,
          agentId: `a1`,
          prompt: `hello world`,
          userId: `repl-user`,
        })
      )
    })

    it(`should update threadId from result`, async () => {
      const executor = makeExecutor({ runResult: { threadId: `t-created` } })
      const renderer = makeRenderer()
      setupMockReadline([`hi`, `/info`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      // /info should show the new thread ID
      expect(joined()).toContain(`t-created`)
    })

    it(`should handle executor errors gracefully`, async () => {
      const executor = makeExecutor()
      ;(executor as any).run = vi.fn().mockRejectedValue(new Error(`Connection failed`))
      const renderer = makeRenderer()
      setupMockReadline([`hello`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderEvent).toHaveBeenCalledWith({
        type: `error`,
        error: `Connection failed`,
      })
    })

    it(`should pass onEvent callback to executor`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`test`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      const runCall = (executor as any).run.mock.calls[0][0]
      expect(runCall.onEvent).toBeTypeOf(`function`)

      // Simulate calling the onEvent callback
      runCall.onEvent({ type: `text`, text: `response` })
      expect(renderer.renderEvent).toHaveBeenCalledWith({
        type: `text`,
        text: `response`,
      })
    })

    it(`should pass existing threadId to executor`, async () => {
      const executor = makeExecutor()
      const renderer = makeRenderer()
      setupMockReadline([`hello`, `/exit`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1`, threadId: `t-existing` })

      expect(executor.run).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: `t-existing`,
        })
      )
    })
  })

  describe(`agent switching`, () => {
    it(`/agent should switch to a new agent`, async () => {
      const executor = makeExecutor({
        listAgents: [
          { id: `a1`, name: `Bot1` },
          { id: `a2`, name: `Bot2` },
        ],
      })
      // For /agent, getAgent will be called again for the new agent
      ;(executor.client.getAgent as any)
        .mockResolvedValueOnce({ id: `a1`, name: `Bot1` }) // initial start
        .mockResolvedValueOnce({ id: `a2`, name: `Bot2` }) // after switch

      const renderer = makeRenderer()
      // First call to createInterface is the main loop, agent switch will also call createInterface
      setupMockReadline([`/agent`, `/exit`], [`2`])

      const repl = new AgentRepl(executor, renderer)
      await repl.start({ orgId: `org1`, agentId: `a1` })

      expect(renderer.renderSuccess).toHaveBeenCalledWith(
        expect.stringContaining(`Switched to agent: Bot2`)
      )
    })
  })
})
