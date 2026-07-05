import type { TSkillReview, TSkillAuthorInput } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import {
  SkillsBlockFence,
  SkillReviewsBlockFence,
  SkillMaxProposalsPerRun,
  SkillMaxInstructionsChars,
} from '@tdsk/domain'

/** Extract the content of the LAST fenced ```{fence}``` block, or undefined. */
export const lastFencedBlock = (text: string, fence: string): string | undefined => {
  const fenceRegex = new RegExp(`\`\`\`${fence}\\s*\\n([\\s\\S]*?)\`\`\``, `g`)
  let last: string | undefined
  for (const match of text.matchAll(fenceRegex)) last = match[1]
  return last
}

/** Parse a JSON array out of a fenced block; non-array / malformed → null. */
export const parseJsonArray = (block: string, fence: string): unknown[] | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    logger.debug(`[skill] Ignoring malformed ${fence} block`)
    return null
  }
  return Array.isArray(parsed) ? parsed : null
}

export const nonEmptyString = (value: unknown): value is string =>
  typeof value === `string` && value.trim().length > 0

export const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === `string`) : []

/**
 * Parse the LAST fenced ```{SkillsBlockFence}``` block out of runtime stdout and
 * return validated skill-proposal entries. A missing block, non-array payload, or
 * malformed JSON yields an empty array (no-op). Entries missing a non-empty
 * name / description / instructions are dropped; instructions are truncated and
 * the batch is capped at SkillMaxProposalsPerRun.
 */
export const parseSkillBlock = (text: string): TSkillAuthorInput[] => {
  if (!text) return []
  const block = lastFencedBlock(text, SkillsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, SkillsBlockFence)
  if (!parsed) return []

  const entries: TSkillAuthorInput[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (
      !nonEmptyString(item.name) ||
      !nonEmptyString(item.description) ||
      !nonEmptyString(item.instructions)
    )
      continue

    entries.push({
      name: item.name.trim(),
      description: item.description.trim(),
      instructions: item.instructions.slice(0, SkillMaxInstructionsChars),
      tools: stringArray(item.tools),
      triggerKeywords: stringArray(item.triggerKeywords),
      alwaysActive: item.alwaysActive === true,
      meta:
        item.meta && typeof item.meta === `object`
          ? (item.meta as Record<string, any>)
          : undefined,
    })
    if (entries.length >= SkillMaxProposalsPerRun) break
  }

  return entries
}

/**
 * Parse the LAST fenced ```{SkillReviewsBlockFence}``` block out of runtime
 * stdout and return validated auditor review decisions. Entries missing a
 * proposalId string or an `approve` boolean are dropped.
 */
export const parseSkillReviewsBlock = (text: string): TSkillReview[] => {
  if (!text) return []
  const block = lastFencedBlock(text, SkillReviewsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, SkillReviewsBlockFence)
  if (!parsed) return []

  const reviews: TSkillReview[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (!nonEmptyString(item.proposalId) || typeof item.approve !== `boolean`) continue

    reviews.push({
      proposalId: item.proposalId.trim(),
      approve: item.approve,
      reason: nonEmptyString(item.reason) ? item.reason.trim() : undefined,
    })
  }

  return reviews
}
