import type { TLLMToolDef } from '@tdsk/domain'
import type { Function as FunctionModel } from '@tdsk/domain'

import { fsTools } from './fs/fs'
import { webTools } from './web/web'
import { codeTools } from './code/code'
import { shellTools } from './shell/definition'

/**
 * All available agent tool definitions
 */
export const allToolDefs: TLLMToolDef[] = [
  ...fsTools,
  ...shellTools,
  ...webTools,
  ...codeTools,
]

/**
 * Get tool definitions filtered by allowed tool names
 */
export const getToolDefs = (allowedTools?: string[]): TLLMToolDef[] => {
  if (!allowedTools || allowedTools.length === 0) return allToolDefs
  return allToolDefs.filter((t) => allowedTools.includes(t.name))
}

/**
 * Convert user-defined functions into LLM tool definitions.
 * Each function becomes a tool the LLM can call by its name.
 */
export const buildFunctionToolDefs = (functions: FunctionModel[]): TLLMToolDef[] => {
  return functions.map((fn) => ({
    name: fn.name,
    description: fn.description || `Custom function: ${fn.name}`,
    inputSchema: {
      type: `object` as const,
      properties: {
        input: {
          type: `object` as const,
          description: `Input data passed to the function`,
        },
      },
    },
  }))
}
