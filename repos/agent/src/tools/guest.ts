/**
 * TODO: Move logic in Tools.call to actual tool definitions
 * Each tool has a schema that defines its interface for the LLM
 * TODO: Should be merged with the actual function definitions
 */

import type { TOnToken, TToolCall, TToolDefinition, TSandboxMetadata } from '@TAG/types'

import { ToolDefinitions } from '@TAG/tools/definitions'

/**
 * Imported by WASM at runtime, declare as noop's so we can reference them
 * TODO: replace these when the real functions are moved into the tools
 */
declare const webSearch: (query: string) => string
declare const shellExec: (cmd: string, args: string[]) => string | Promise<string>

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

// Sub-agent orchestration
declare const spawnSubAgent: (
  subAgentId: string,
  prompt: string
) => string | Promise<string>
declare const sendMessageToSubAgent: (
  subAgentId: string,
  message: string
) => string | Promise<string>
declare const receiveMessageFromSubAgent: (subAgentId: string) => string | Promise<string>
declare const terminateSubAgent: (subAgentId: string) => string | Promise<string>

/** ------ End WASM imports ------ */

export class GuestTools {
  constructor() {}

  /**
   * Get tool definitions filtered by allow/disallow lists
   *
   * @param allowList - List of tool names to allow (if specified, only these tools are included)
   * @param disallowList - List of tool names to disallow (these tools are excluded)
   * @param customTools - Optional array of custom user-supplied tools
   * @returns Array of tool definitions to register with the LLM
   */
  get = (
    allowList?: string[],
    disallowList?: string[],
    customTools?: TSandboxMetadata[]
  ): TToolDefinition[] => {
    const allTools = Object.keys(ToolDefinitions)

    // If allowList is specified, only include those tools
    let selectedTools = allowList
      ? allowList.filter((t) => allTools.includes(t))
      : allTools

    // Remove disallowed tools
    if (disallowList) {
      selectedTools = selectedTools.filter((t) => !disallowList.includes(t))
    }

    const builtInTools = selectedTools.map((name) => ToolDefinitions[name])

    // Add custom tools if provided
    if (customTools && customTools.length > 0) {
      const customToolDefs: TToolDefinition[] = customTools.map((tool) => ({
        type: `function`,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
      return [...builtInTools, ...customToolDefs]
    }

    return builtInTools
  }

  /**
   * Convert tool definitions for Anthropic API format
   * Anthropic uses a slightly different schema structure
   */
  asAnthropic = (tools: TToolDefinition[]) => {
    return tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }))
  }

  /**
   * Execute a tool call and return the result
   */
  call = async (onToken: TOnToken, toolCall: TToolCall): Promise<string> => {
    const { name, arguments: argsJson } = toolCall.function

    try {
      const args = JSON.parse(argsJson)

      if (name === `shellExec`) {
        const { command, args: cmdArgs } = args
        onToken(`\n[Tool: shellExec] Running: ${command} ${cmdArgs.join(` `)}\n`)
        const output = await shellExec(command, cmdArgs)
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

      // Sub-agent orchestration tools
      if (name === `spawnSubAgent`) {
        const { subAgentId, prompt } = args
        onToken(`\n[Tool: spawnSubAgent] Spawning sub-agent: ${subAgentId}\n`)
        const result = await spawnSubAgent(subAgentId, prompt)
        onToken(`[Result] ${result}\n`)
        return result
      }

      if (name === `sendMessageToSubAgent`) {
        const { subAgentId, message } = args
        onToken(`\n[Tool: sendMessageToSubAgent] Sending to ${subAgentId}\n`)
        const result = await sendMessageToSubAgent(subAgentId, message)
        onToken(`[Result] ${result}\n`)
        return result
      }

      if (name === `receiveMessageFromSubAgent`) {
        const { subAgentId } = args
        onToken(`\n[Tool: receiveMessageFromSubAgent] Receiving from ${subAgentId}\n`)
        const result = await receiveMessageFromSubAgent(subAgentId)
        onToken(`[Message]\n${result}\n`)
        return result
      }

      if (name === `terminateSubAgent`) {
        const { subAgentId } = args
        onToken(`\n[Tool: terminateSubAgent] Terminating: ${subAgentId}\n`)
        const result = await terminateSubAgent(subAgentId)
        onToken(`[Result] ${result}\n`)
        return result
      }

      // Check if this is a custom tool (not a built-in tool)
      // Custom tools are identified by not being in the built-in tool list
      const builtInTools = Object.keys(ToolDefinitions)

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
}
