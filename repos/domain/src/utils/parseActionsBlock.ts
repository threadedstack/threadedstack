import type { TAgentAction } from '@TDM/types/actions.types'

import { ActionsBlockFence } from '@TDM/constants/actions'

/**
 * Extract the LAST fenced ```<fence>``` block out of a text stream. Multiple
 * blocks → the last one wins (mirrors the tdsk-actions / tdsk-memories fence
 * conventions). Returns undefined when no block is present.
 */
export const extractLastFencedBlock = (
  text: string,
  fence: string
): string | undefined => {
  if (!text) return undefined

  const fenceRegex = new RegExp(`\`\`\`${fence}\\s*\\n([\\s\\S]*?)\`\`\``, `g`)
  let lastBlock: string | undefined
  for (const match of text.matchAll(fenceRegex)) lastBlock = match[1]
  return lastBlock
}

/**
 * Parse the LAST fenced ```tdsk-actions``` block out of runtime stdout into
 * validated actions. Accepts either a bare array `[{function,args}]` or
 * `{ "actions": [ ... ] }`. A missing/invalid block, non-array payload, or
 * malformed JSON yields `[]` (no-op). Entries without a non-empty string
 * `function` are dropped; `args` defaults to `{}`.
 *
 * Shared home for the ② effect-surface parser: the backend dispatch path and
 * the resident runtime's action pump both consume it.
 */
export const parseActionsBlock = (text: string): TAgentAction[] => {
  const lastBlock = extractLastFencedBlock(text, ActionsBlockFence)
  if (lastBlock === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(lastBlock)
  } catch {
    // Malformed JSON in the block is a no-op by contract — the emitting
    // session simply produced no dispatchable actions this turn.
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
