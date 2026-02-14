import { describe, it, expect } from 'vitest'

/**
 * Dependency contract test — validates that all imports used by
 * the agent service actually resolve from @tdsk/agent.
 *
 * Unlike agent.test.ts which mocks @tdsk/agent, this file imports
 * the real module. If a refactor in @tdsk/agent or @tdsk/sandbox
 * removes or breaks an export, this test fails immediately.
 */
describe(`agent service dependency contract`, () => {
  it(`should resolve all @tdsk/agent imports used by runAgent.ts`, async () => {
    const mod = await import(`@tdsk/agent`)

    expect(mod.Mutex).toBeDefined()
    expect(typeof mod.Mutex).toBe(`function`)

    expect(mod.createLLMAdapter).toBeDefined()
    expect(typeof mod.createLLMAdapter).toBe(`function`)

    expect(mod.createSandboxProvider).toBeDefined()
    expect(typeof mod.createSandboxProvider).toBe(`function`)

    expect(mod.getToolDefs).toBeDefined()
    expect(typeof mod.getToolDefs).toBe(`function`)

    // AgentRunner is now exported from @tdsk/agent (extracted from backend)
    expect(mod.AgentRunner).toBeDefined()
    expect(typeof mod.AgentRunner).toBe(`function`)
  })

  it(`should resolve all @tdsk/domain imports used by agent.ts`, async () => {
    const mod = await import(`@tdsk/domain`)

    expect(mod.EContentType).toBeDefined()
    expect(mod.EContentType.text).toBe(`text`)
    expect(mod.EContentType.toolUse).toBe(`tool_use`)
    expect(mod.EContentType.toolResult).toBe(`tool_result`)

    expect(mod.EStreamEventType).toBeDefined()
    expect(mod.EStreamEventType.text).toBe(`text`)
    expect(mod.EStreamEventType.toolCallStart).toBe(`tool_call_start`)
    expect(mod.EStreamEventType.done).toBe(`done`)
    expect(mod.EStreamEventType.error).toBe(`error`)

    expect(mod.EAgentTool).toBeDefined()
    expect(mod.EAgentTool.shellExec).toBe(`shellExec`)
    expect(mod.EAgentTool.readFile).toBe(`readFile`)
    expect(mod.EAgentTool.writeFile).toBe(`writeFile`)
  })
})
