import type {
  TTaskProposalInput,
  TTaskPickup,
  TTaskPriority,
  TTaskSourceSignal,
} from '@tdsk/domain'

import {
  TasksBlockFence,
  TaskPickupsBlockFence,
  TaskMaxProposalsPerRun,
  TaskMaxDescriptionChars,
  TaskMaxEvidenceChars,
  ETaskPriority,
  ETaskSourceSignal,
} from '@tdsk/domain'

import { lastFencedBlock, parseJsonArray, nonEmptyString, stringArray } from './skill'

/** Maximum length of a derived (or provided) dedupeKey. */
const DedupeKeyMaxLength = 200

const ValidPriorities = new Set<string>(Object.values(ETaskPriority))
const ValidSourceSignals = new Set<string>(Object.values(ETaskSourceSignal))

const coercePriority = (value: unknown): TTaskPriority =>
  typeof value === `string` && ValidPriorities.has(value)
    ? (value as TTaskPriority)
    : ETaskPriority.P3

const coerceSourceSignal = (value: unknown): TTaskSourceSignal =>
  typeof value === `string` && ValidSourceSignals.has(value)
    ? (value as TTaskSourceSignal)
    : ETaskSourceSignal.other

/** Lowercase, dash-delimited slug used to derive a fallback dedupeKey from a task title. */
const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, `-`)
    .replace(/^-+|-+$/g, ``)

/** Derive a dedupeKey as `${sourceSignal}:${slug(title)}`, capped at DedupeKeyMaxLength. */
const deriveDedupeKey = (sourceSignal: TTaskSourceSignal, title: string): string => {
  const prefix = `${sourceSignal}:`
  const available = Math.max(0, DedupeKeyMaxLength - prefix.length)
  const slugged = slug(title).slice(0, available).replace(/-+$/g, ``)
  return `${prefix}${slugged}`
}

/** `value` is a homogeneous string array (used for the optional `repos` field). */
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === `string`)

/**
 * Parse the LAST fenced ```{TasksBlockFence}``` block out of runtime stdout and
 * return validated task-proposal entries. A missing block, non-array payload, or
 * malformed JSON yields an empty array (no-op). Entries missing a non-empty
 * title / description / evidence are dropped; priority and sourceSignal are
 * coerced to valid enum values (defaulting to P3 / other); a missing dedupeKey
 * is derived from the sourceSignal + a slugified title; description and
 * evidence are truncated to their max lengths; the batch is capped at
 * TaskMaxProposalsPerRun.
 */
export const parseTasksBlock = (text: string): TTaskProposalInput[] => {
  if (!text) return []
  const block = lastFencedBlock(text, TasksBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, TasksBlockFence)
  if (!parsed) return []

  const entries: TTaskProposalInput[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (
      !nonEmptyString(item.title) ||
      !nonEmptyString(item.description) ||
      !nonEmptyString(item.evidence)
    )
      continue

    const title = item.title.trim()
    const sourceSignal = coerceSourceSignal(item.sourceSignal)

    entries.push({
      title,
      description: item.description.trim().slice(0, TaskMaxDescriptionChars),
      priority: coercePriority(item.priority),
      evidence: item.evidence.trim().slice(0, TaskMaxEvidenceChars),
      sourceSignal,
      dedupeKey: nonEmptyString(item.dedupeKey)
        ? item.dedupeKey.trim()
        : deriveDedupeKey(sourceSignal, title),
      repos: isStringArray(item.repos) ? stringArray(item.repos) : undefined,
      parentId: nonEmptyString(item.parentId) ? item.parentId.trim() : undefined,
      initiative: nonEmptyString(item.initiative) ? item.initiative.trim() : undefined,
      meta:
        item.meta && typeof item.meta === `object`
          ? (item.meta as Record<string, any>)
          : undefined,
    })
    if (entries.length >= TaskMaxProposalsPerRun) break
  }

  return entries
}

/**
 * Parse the LAST fenced ```{TaskPickupsBlockFence}``` block out of runtime
 * stdout and return validated task-pickup entries. Entries missing a
 * non-empty proposalId are dropped.
 */
export const parseTaskPickupsBlock = (text: string): TTaskPickup[] => {
  if (!text) return []
  const block = lastFencedBlock(text, TaskPickupsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, TaskPickupsBlockFence)
  if (!parsed) return []

  const pickups: TTaskPickup[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (!nonEmptyString(item.proposalId)) continue

    pickups.push({
      proposalId: item.proposalId.trim(),
      prUrl: nonEmptyString(item.prUrl) ? item.prUrl.trim() : undefined,
      note: nonEmptyString(item.note) ? item.note.trim() : undefined,
    })
  }

  return pickups
}
