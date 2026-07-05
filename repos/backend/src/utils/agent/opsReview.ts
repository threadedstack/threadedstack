import { OpsReviewsBlockFence } from '@tdsk/domain'
import { lastFencedBlock, parseJsonArray, nonEmptyString } from './skill'

export type TOpsReview = { opsActionId: string; approve: boolean; reason?: string }

/**
 * Parse the LAST tdsk-ops-reviews block from runtime stdout.
 * Malformed JSON or missing block yields [].
 * Per-entry: drop if opsActionId is missing/empty or approve is not a boolean.
 */
export const parseOpsReviewsBlock = (text: string): TOpsReview[] => {
  if (!text) return []
  const block = lastFencedBlock(text, OpsReviewsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, OpsReviewsBlockFence)
  if (!parsed) return []

  const out: TOpsReview[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const opsActionId = (item as any).opsActionId
    const approve = (item as any).approve
    if (!nonEmptyString(opsActionId)) continue
    if (typeof approve !== 'boolean') continue
    const entry: TOpsReview = { opsActionId, approve }
    if (nonEmptyString((item as any).reason)) entry.reason = (item as any).reason
    out.push(entry)
  }
  return out
}
