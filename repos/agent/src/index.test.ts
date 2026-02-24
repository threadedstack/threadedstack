import { describe, it, expect } from 'vitest'
import * as agentExports from './index'

/**
 * Public API contract test — ensures expected symbols are exported from @tdsk/agent.
 * If a refactor removes or renames an export, this test will catch it immediately
 * instead of allowing downstream consumers (e.g. @tdsk/backend) to silently break.
 */
describe(`@tdsk/agent public API`, () => {
  const expectedExports = [
    // runner
    `AgentRunner`,
    // tools
    `getToolDefs`,
    `createSandboxTools`,
    // adapters
    `mapAgentEvent`,
    `convertToLlmMessages`,
    `convertAssistantToContent`,
    `convertToolResultToContent`,
  ]

  it.each(expectedExports)(`should export "%s"`, (name) => {
    expect(agentExports).toHaveProperty(name)
    expect((agentExports as any)[name]).toBeDefined()
  })

  it(`should export AgentRunner with a static run method`, () => {
    expect(typeof (agentExports as any).AgentRunner.run).toBe(`function`)
  })
})
