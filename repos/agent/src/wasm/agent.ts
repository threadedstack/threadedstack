import type { TMessage, TLLMProvider } from '@TAG/types'

import { logger } from '@TAG/wasm/logger'
import { Context } from '@TAG/wasm/context'
import { GuestTools } from '@TAG/tools/guest'
import { getProvider } from '@TAG/wasm/provider'

// @ts-ignore - The compiler doesn't know about this virtual module yet
import { getEnvironment } from 'wasi:cli/environment@0.2.0'

// Imported by WASM at runtime, so define noop so we can reference it
declare const onToken: (token: string) => void

const getEnvs = (envs: string[]) => {
  const loaded = {} as Record<string, string>
  const data = getEnvironment() as [string, string][]
  for (const [k, v] of data) {
    if (envs.includes(k)) loaded[k] = v
  }
  return loaded
}

/**
 * Restore conversation history from environment
 * This allows resuming previous conversations
 */
const restoreHistory = (envs: Record<string, string>): TMessage[] => {
  // History will be restored from environment or initialized empty
  const history: TMessage[] = []

  const historyJson = envs.AGENT_INITIAL_HISTORY
  if (historyJson) {
    try {
      const restored = JSON.parse(historyJson) as TMessage[]
      if (Array.isArray(restored)) {
        history.length = 0
        history.push(...restored)
        onToken(`[Agent] Restored ${restored.length} previous message(s)\n`)
      }
    } catch (error) {
      onToken(`[Warning] Failed to restore conversation history: ${error}\n`)
    }
  }

  return history
}

/**
 * Main entry point for WASM agent
 * This function is called from the Host via WASM bridge
 *
 * Implements a ReAct loop:
 * 1. Get AI response (may include tool calls)
 * 2. Execute any tool calls
 * 3. Return results to AI
 * 4. Repeat until AI indicates completion (no more tool calls)
 * 5. Stream final response
 */
export const processRequest = async (prompt: string): Promise<void> => {
  try {
    // Get provider configuration from environment (injected by Host)
    const envs = getEnvs([
      `AGENT_URL`,
      `AGENT_MODEL`,
      `AGENT_PATH`,
      `AGENT_API_KEY`,
      `AGENT_PROVIDER`,
      `AGENT_MAX_TOKENS`,
      `AGENT_TOOLS_ALLOW`,
      `AGENT_CUSTOM_TOOLS`,
      `AGENT_TOOLS_DISALLOW`,
      `AGENT_INITIAL_HISTORY`,
    ])

    const tools = new GuestTools()

    // Restore conversation history if provided
    const history = restoreHistory(envs)

    const max = envs.AGENT_MAX_TOKENS
    const ctx = new Context({ max: max ? Number.parseInt(max, 10) : 100000 })

    const provider = getProvider({
      url: envs.AGENT_URL || ``,
      path: envs.AGENT_PATH || ``,
      model: envs.AGENT_MODEL || ``,
      key: envs.AGENT_API_KEY || ``,
      type: envs.AGENT_PROVIDER as TLLMProvider,
    })

    // Get tool configuration from environment
    const allowList = envs.AGENT_TOOLS_ALLOW
      ? JSON.parse(envs.AGENT_TOOLS_ALLOW)
      : undefined
    const disallowList = envs.AGENT_TOOLS_DISALLOW
      ? JSON.parse(envs.AGENT_TOOLS_DISALLOW)
      : undefined
    const customTools = envs.AGENT_CUSTOM_TOOLS
      ? JSON.parse(envs.AGENT_CUSTOM_TOOLS)
      : undefined

    // Get filtered tool definitions based on allow/disallow lists
    const definitions = tools.get(allowList, disallowList, customTools)

    // Convert to appropriate format based on provider
    const formatted =
      envs.AGENT_PROVIDER === `anthropic` ? tools.asAnthropic(definitions) : definitions

    // Add user prompt to history
    history.push({ role: 'user', content: prompt })

    const systemPrompt = `You are a helpful coding agent with access to tools.

Available tools:
- shellExec: Execute shell commands in the project directory
- webSearch: Search the web for information

Use tools when needed to accomplish tasks. When you're done and have provided a complete answer, respond without calling any more tools.`

    // ReAct Loop: Continue until AI stops calling tools
    let maxIterations = 10 // Safety limit
    let iteration = 0

    while (iteration < maxIterations) {
      iteration++

      // Compose context with token management
      const { system, messages } = ctx.compose(systemPrompt, history)

      // Get AI response with available tools
      onToken(`\n[Agent] Processing (iteration ${iteration})...\n`)
      const response = await provider.complete(system, messages, formatted)

      // Stream AI's text response if present
      if (response.content) {
        onToken(`\n${response.content}\n`)
      }

      // Add assistant message to history
      history.push({
        role: `assistant`,
        content: response.content || `(calling tools)`,
        tool_calls: response.tool_calls,
      })

      // Check if there are tool calls
      if (!response.tool_calls || response.tool_calls.length === 0) {
        // No more tool calls - we`re done
        onToken(`\n[Agent] Task completed.\n`)
        break
      }

      // Execute all tool calls
      onToken(`\n[Agent] Executing ${response.tool_calls.length} tool(s)...\n`)

      for (const toolCall of response.tool_calls) {
        const toolResult = await tools.call(onToken, toolCall)

        // Add tool result to history
        history.push({
          role: `tool`,
          content: toolResult,
          tool_call_id: toolCall.id,
        })
      }

      // Continue loop to get next AI response with tool results
    }

    if (iteration >= maxIterations) {
      onToken(`\n[Warning] Maximum iterations reached. Task may be incomplete.\n`)
    }
  } catch (error: any) {
    onToken(`\n[Error] ${error.message}\n`)
    throw error
  }
}
