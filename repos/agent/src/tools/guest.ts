/**
 * TODO: Move logic in Tools.call to actual tool definitions
 * Each tool has a schema that defines its interface for the LLM
 * TODO: Should be merged with the actual function definitions
 */

import type {
  TOnToken,
  TToolCall,
  TMessage,
  ILLMProvider,
  TToolDefinition,
  TSandboxMetadata,
} from '@TAG/types'

import { logger } from '@TAG/wasm/logger'
import { BuiltInTools } from '@TAG/tools/builtins'
import { ToolDefinitions } from '@TAG/tools/definitions'

export type TGuestTools = {
  history: TMessage[]
  provider: ILLMProvider
  allowedTools?: string[]
  disabledTools?: string[]
  customTools?: TSandboxMetadata[]
}

export class GuestTools {
  provider: ILLMProvider
  history: TMessage[] = []
  allowedTools: string[] = []
  disabledTools: string[] = []
  customTools: TSandboxMetadata[] = []

  constructor(opts: TGuestTools) {
    const { history, provider, customTools, allowedTools, disabledTools } = opts

    this.provider = provider

    if (history) this.history = history
    if (customTools?.length) this.customTools = customTools
    if (allowedTools?.length) this.allowedTools = allowedTools
    if (disabledTools?.length) this.disabledTools = disabledTools
  }

  get = (name: string) => BuiltInTools?.[name]?.(this)

  /**
   * Get tool definitions filtered by allow/disallow lists
   *
   * @param allowList - List of tool names to allow (if specified, only these tools are included)
   * @param disallowList - List of tool names to disallow (these tools are excluded)
   * @param customTools - Optional array of custom user-supplied tools
   * @returns Array of tool definitions to register with the LLM
   */
  list = (): TToolDefinition[] => {
    const allTools = Object.keys(ToolDefinitions)

    // If allowList is specified, only include those tools
    let selectedTools = this.allowedTools
      ? this.allowedTools.filter((t) => allTools.includes(t))
      : allTools

    // Remove disallowed tools
    if (this.disabledTools)
      selectedTools = selectedTools.filter((t) => !this.disabledTools.includes(t))

    const builtInTools = selectedTools.map((name) => ToolDefinitions[name])

    // Add custom tools if provided
    if (this.customTools && this.customTools.length > 0) {
      const customToolDefs: TToolDefinition[] = this.customTools.map((tool) => ({
        type: `function`,
        function: {
          name: tool.name,
          parameters: tool.parameters,
          description: tool.description,
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
    const { name, arguments: json } = toolCall.function

    try {
      // Check if this is a custom tool (not a built-in tool)
      // Custom tools are identified by not being in the built-in tool list
      const builtInTools = Object.keys(ToolDefinitions)
      const method = builtInTools.includes(name)
        ? this.get(name)
        : this.get(`executeCustomTool`)

      if (!method) throw new Error(`Tool ${name} could not be found!`)
      const args = JSON.parse(json)

      return await method?.({
        args,
        name,
        json,
        onToken,
      })
    } catch (error: any) {
      const errorMsg = `Error executing ${name}: ${error.message}`
      onToken(`[Error] ${errorMsg}\n`)
      return errorMsg
    }
  }
}
