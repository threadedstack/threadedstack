import type { TEscalationInput, TEscalationResolution } from '@tdsk/domain'

import {
  EscalationsBlockFence,
  EscalationResolutionsBlockFence,
  EscalationMaxPerRun,
  EEscalationTarget,
} from '@tdsk/domain'

import { lastFencedBlock, parseJsonArray, nonEmptyString, stringArray } from './skill'

const ValidTargets = new Set<string>(Object.values(EEscalationTarget))
const ValidResolutionStatuses = new Set<string>([`resolved`, `rejected`])

/**
 * Parse the LAST fenced ```{EscalationsBlockFence}``` block out of runtime
 * stdout and return validated escalation-input entries. A missing block,
 * non-array payload, or malformed JSON yields an empty array (no-op).
 * Entries missing a non-empty title / problem or an invalid target are
 * dropped. The batch is capped at EscalationMaxPerRun (3).
 */
export const parseEscalationBlock = (text: string): TEscalationInput[] => {
  if (!text) return []
  const block = lastFencedBlock(text, EscalationsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, EscalationsBlockFence)
  if (!parsed) return []

  const entries: TEscalationInput[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>

    if (!nonEmptyString(item.title) || !nonEmptyString(item.problem)) continue
    if (!nonEmptyString(item.target) || !ValidTargets.has(item.target)) continue

    const entry: TEscalationInput = {
      title: item.title.trim(),
      problem: item.problem.trim(),
      target: item.target as TEscalationInput[`target`],
      evidence: stringArray(item.evidence),
      proposedPatch: nonEmptyString(item.proposedPatch)
        ? item.proposedPatch.trim()
        : null,
    }

    if (nonEmptyString(item.dedupeKey)) entry.dedupeKey = item.dedupeKey.trim()
    if (nonEmptyString(item.issueRef)) entry.issueRef = item.issueRef.trim()
    if (item.meta && typeof item.meta === `object` && !Array.isArray(item.meta))
      entry.meta = item.meta as Record<string, any>

    entries.push(entry)
    if (entries.length >= EscalationMaxPerRun) break
  }

  return entries
}

/**
 * Parse the LAST fenced ```{EscalationResolutionsBlockFence}``` block out of
 * runtime stdout and return validated escalation-resolution entries. Entries
 * with a status other than 'resolved' or 'rejected' are dropped, as are
 * entries lacking both id and dedupeKey (the resolver needs at least one).
 */
export const parseEscalationResolutionsBlock = (
  text: string
): TEscalationResolution[] => {
  if (!text) return []
  const block = lastFencedBlock(text, EscalationResolutionsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, EscalationResolutionsBlockFence)
  if (!parsed) return []

  const resolutions: TEscalationResolution[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>

    if (!nonEmptyString(item.status) || !ValidResolutionStatuses.has(item.status))
      continue

    const hasId = nonEmptyString(item.id)
    const hasDedupeKey = nonEmptyString(item.dedupeKey)
    if (!hasId && !hasDedupeKey) continue

    const resolution: TEscalationResolution = {
      status: item.status as TEscalationResolution[`status`],
    }

    if (hasId) resolution.id = (item.id as string).trim()
    if (hasDedupeKey) resolution.dedupeKey = (item.dedupeKey as string).trim()
    if (nonEmptyString(item.resolvedRef)) resolution.resolvedRef = item.resolvedRef.trim()
    if (nonEmptyString(item.reason)) resolution.reason = item.reason.trim()

    resolutions.push(resolution)
  }

  return resolutions
}
