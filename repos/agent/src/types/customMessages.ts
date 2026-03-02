/**
 * Custom AgentMessage types for ThreadedStack.
 *
 * Uses pi-agent-core's declaration merging to add artifact, notification,
 * and systemEvent roles. These message types are stored in the agent's
 * message history but filtered out by convertToLlm before LLM calls.
 *
 * IMPORTANT: The `export {}` below is required to make this file a module.
 * Without it, `declare module` creates an ambient module declaration that
 * REPLACES all existing pi-agent-core types instead of augmenting them.
 */
export {}

declare module '@mariozechner/pi-agent-core' {
  interface CustomAgentMessages {
    artifact: {
      role: `artifact`
      content: string
      mimeType: string
      title: string
      timestamp: number
    }
    notification: {
      role: `notification`
      text: string
      level: `info` | `warn` | `error`
      timestamp: number
    }
    systemEvent: {
      role: `systemEvent`
      event: string
      data: Record<string, unknown>
      timestamp: number
    }
  }
}
