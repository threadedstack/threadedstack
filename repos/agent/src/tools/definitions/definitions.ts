import type { TLLMToolDef } from '@tdsk/domain'

import { fsTools } from './fs/fs'
import { webTools } from './web/web'
import { shellTools } from './shell/definition'

/**
 * All available agent tool definitions
 */
export const allToolDefs: TLLMToolDef[] = [...fsTools, ...shellTools, ...webTools]

/**
 * Get tool definitions filtered by allowed tool names
 */
export const getToolDefs = (allowedTools?: string[]): TLLMToolDef[] => {
  if (!allowedTools || allowedTools.length === 0) return allToolDefs
  return allToolDefs.filter((t) => allowedTools.includes(t.name))
}
