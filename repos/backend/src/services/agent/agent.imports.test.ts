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

    // AgentRunner replaces the old AgentRunner
    expect(mod.AgentRunner).toBeDefined()
    expect(typeof mod.AgentRunner).toBe(`function`)

    // getToolDefs — from tools/definitions
    expect(mod.getToolDefs).toBeDefined()
    expect(typeof mod.getToolDefs).toBe(`function`)

    // createSandboxTools — pi-mono tool bridge
    expect(mod.createSandboxTools).toBeDefined()
    expect(typeof mod.createSandboxTools).toBe(`function`)

    // createProxyStreamFn — proxy stream function
    expect(mod.createProxyStreamFn).toBeDefined()
    expect(typeof mod.createProxyStreamFn).toBe(`function`)

    // mapAgentEvent — event bridge
    expect(mod.mapAgentEvent).toBeDefined()
    expect(typeof mod.mapAgentEvent).toBe(`function`)

    // Message converters
    expect(mod.convertToLlmMessages).toBeDefined()
    expect(typeof mod.convertToLlmMessages).toBe(`function`)

    expect(mod.convertAssistantToContent).toBeDefined()
    expect(typeof mod.convertAssistantToContent).toBe(`function`)

    expect(mod.convertToolResultToContent).toBeDefined()
    expect(typeof mod.convertToolResultToContent).toBe(`function`)
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
