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
export const parseActionsBlock = (text: string): TAgentAction[] =>
  parseActionsBlockWithMeta(text).actions

/**
 * Count every fenced ```tdsk-actions``` block present in a text stream —
 * companion to `extractLastFencedBlock`'s "last one wins" behavior, so a
 * caller can tell whether earlier blocks in the same turn were silently
 * discarded (see `parseActionsBlockWithMeta`).
 */
const countFencedBlocks = (text: string, fence: string): number => {
  if (!text) return 0
  const fenceRegex = new RegExp(`\`\`\`${fence}\\s*\\n([\\s\\S]*?)\`\`\``, `g`)
  let count = 0
  for (const _match of text.matchAll(fenceRegex)) count += 1
  return count
}

/**
 * Same parse as `parseActionsBlock`, but also reports how many
 * ```tdsk-actions``` fenced blocks were found in the text. When more than
 * one block is present, only the last is ever parsed (by contract — see
 * `extractLastFencedBlock`) and every earlier block is silently discarded.
 * Callers that want visibility into that (e.g. the resident pump, which logs
 * a warning) should use this instead of `parseActionsBlock`.
 */
export const parseActionsBlockWithMeta = (
  text: string
): { actions: TAgentAction[]; blockCount: number } => {
  const blockCount = countFencedBlocks(text, ActionsBlockFence)
  const lastBlock = extractLastFencedBlock(text, ActionsBlockFence)
  if (lastBlock === undefined) return { actions: [], blockCount }

  let parsed: unknown
  try {
    parsed = JSON.parse(lastBlock)
  } catch {
    // Malformed JSON in the block is a no-op by contract — the emitting
    // session simply produced no dispatchable actions this turn.
    return { actions: [], blockCount }
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
  return { actions, blockCount }
}
