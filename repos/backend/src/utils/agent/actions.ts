import type { TAgentAction } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { ActionsBlockFence } from '@tdsk/domain'

/**
 * Parse the LAST fenced ```tdsk-actions``` block out of runtime stdout into
 * validated actions. Accepts either a bare array `[{function,args}]` or
 * `{ "actions": [ ... ] }`. A missing/invalid block, non-array payload, or
 * malformed JSON yields `[]` (no-op). Entries without a non-empty string
 * `function` are dropped; `args` defaults to `{}`.
 */
export const parseActionsBlock = (text: string): TAgentAction[] => {
  if (!text) return []

  const fenceRegex = new RegExp(
    `\`\`\`${ActionsBlockFence}\\s*\\n([\\s\\S]*?)\`\`\``,
    `g`
  )
  let lastBlock: string | undefined
  for (const match of text.matchAll(fenceRegex)) lastBlock = match[1]
  if (lastBlock === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(lastBlock)
  } catch {
    logger.debug(`[actions] Ignoring malformed tdsk-actions block`)
    return []
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === `object` && Array.isArray((parsed as any).actions)
      ? (parsed as any).actions
      : []

  const actions: TAgentAction[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (typeof item.function !== `string` || item.function.trim().length === 0) continue
    actions.push({
      function: item.function,
      args:
        item.args && typeof item.args === `object` && !Array.isArray(item.args)
          ? (item.args as Record<string, unknown>)
          : {},
    })
  }
  return actions
}
