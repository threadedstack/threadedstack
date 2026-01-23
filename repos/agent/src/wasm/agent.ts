import type { TMessage, TLLMProvider, TToolCall } from '@TAG/types'

import { Context } from '@TAG/wasm/context'
import { getProvider } from '@TAG/wasm/provider'
import { getToolDefinitions, convertToAnthropicTools } from '@TAG/wasm/tools'
// @ts-ignore - The compiler doesn't know about this virtual module yet
import { getEnvironment } from 'wasi:cli/environment@0.2.0'

// These would be imported from WASM component in actual implementation
// For now, we'll define the interface
declare const onToken: (token: string) => void
declare const webSearch: (query: string) => string
declare const executeShell: (cmd: string, args: string[]) => string | Promise<string>

// Filesystem operations
declare const readFile: (path: string) => string | Promise<string>
declare const deleteFile: (path: string) => string | Promise<string>
declare const fileExists: (path: string) => boolean | Promise<boolean>
declare const getFileStats: (path: string) => string | Promise<string>
declare const createDirectory: (path: string) => string | Promise<string>
declare const listDirectory: (path: string) => string[] | Promise<string[]>
declare const writeFile: (path: string, content: string) => string | Promise<string>

// Custom tool execution
declare const executeCustomTool: (
  toolName: string,
  argsJson: string
) => string | Promise<string>

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
 * Execute a tool call and return the result
 */
const executeTool = async (toolCall: TToolCall): Promise<string> => {
  const { name, arguments: argsJson } = toolCall.function

  try {
    const args = JSON.parse(argsJson)

    if (name === `executeShell`) {
      const { command, args: cmdArgs } = args
      onToken(`\n[Tool: executeShell] Running: ${command} ${cmdArgs.join(` `)}\n`)
      const output = await executeShell(command, cmdArgs)
      onToken(`[Output]\n${output}\n`)
      return output
    }

    if (name === `webSearch`) {
      const { query } = args
      onToken(`\n[Tool: webSearch] Searching: ${query}\n`)
      const results = webSearch(query)
      onToken(`[Results]\n${results}\n`)
      return results
    }

    // Filesystem operations
    if (name === `readFile`) {
      const { path } = args
      onToken(`\n[Tool: readFile] Reading: ${path}\n`)
      const content = await readFile(path)
      onToken(`[Content] ${content.length} bytes read\n`)
      return content
    }

    if (name === `writeFile`) {
      const { path, content } = args
      onToken(`\n[Tool: writeFile] Writing to: ${path}\n`)
      const result = await writeFile(path, content)
      onToken(`[Result] ${result}\n`)
      return result
    }

    if (name === `listDirectory`) {
      const { path } = args
      onToken(`\n[Tool: listDirectory] Listing: ${path}\n`)
      const entries = await listDirectory(path)
      const result = entries.join(`\n`)
      onToken(`[Entries]\n${result}\n`)
      return result
    }

    if (name === `deleteFile`) {
      const { path } = args
      onToken(`\n[Tool: deleteFile] Deleting: ${path}\n`)
      const result = await deleteFile(path)
      onToken(`[Result] ${result}\n`)
      return result
    }

    if (name === `createDirectory`) {
      const { path } = args
      onToken(`\n[Tool: createDirectory] Creating: ${path}\n`)
      const result = await createDirectory(path)
      onToken(`[Result] ${result}\n`)
      return result
    }

    if (name === `fileExists`) {
      const { path } = args
      onToken(`\n[Tool: fileExists] Checking: ${path}\n`)
      const exists = await fileExists(path)
      const result = exists ? `File exists` : `File does not exist`
      onToken(`[Result] ${result}\n`)
      return result
    }

    if (name === `getFileStats`) {
      const { path } = args
      onToken(`\n[Tool: getFileStats] Getting stats for: ${path}\n`)
      const stats = await getFileStats(path)
      onToken(`[Stats]\n${stats}\n`)
      return stats
    }

    // Check if this is a custom tool (not a built-in tool)
    // Custom tools are identified by not being in the built-in tool list
    const builtInTools = [
      `readFile`,
      `writeFile`,
      `webSearch`,
      `deleteFile`,
      `fileExists`,
      `getFileStats`,
      `executeShell`,
      `listDirectory`,
      `createDirectory`,
    ]

    if (!builtInTools.includes(name)) {
      // This is a custom tool - execute via Host Bridge
      onToken(`\n[Custom Tool: ${name}] Executing user-supplied code...\n`)
      const result = await executeCustomTool(name, argsJson)
      onToken(`[Result]\n${result}\n`)
      return result
    }

    throw new Error(`Unknown tool: ${name}`)
  } catch (error: any) {
    const errorMsg = `Error executing ${name}: ${error.message}`
    onToken(`[Error] ${errorMsg}\n`)
    return errorMsg
  }
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
      `AGENT_TOOLS_DISALLOW`,
      `AGENT_INITIAL_HISTORY`,
      `AGENT_CUSTOM_TOOLS`,
    ])

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
    const toolDefinitions = getToolDefinitions(allowList, disallowList, customTools)

    // Convert to appropriate format based on provider
    const tools =
      envs.AGENT_PROVIDER === 'anthropic'
        ? convertToAnthropicTools(toolDefinitions)
        : toolDefinitions

    // Add user prompt to history
    history.push({ role: 'user', content: prompt })

    const systemPrompt = `You are a helpful coding agent with access to tools.

Available tools:
- executeShell: Execute shell commands in the project directory
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
      const response = await provider.complete(system, messages, tools)

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
        const toolResult = await executeTool(toolCall)

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
