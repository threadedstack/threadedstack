/**
 * Constants and parsers for the executive board (AI Executive Layer SP1).
 * Mirrors the task-proposal / escalation / verify conventions: the runtime brain
 * emits fenced structured-output blocks that the scheduler executor parses
 * server-side. Each parser reads only the LAST fenced block, never throws, and
 * drops malformed entries.
 *
 * The fenced-block helpers are kept module-private here (domain cannot depend on
 * the backend `skill.ts` copies) and mirror their behaviour exactly.
 */

import type {
  TStrategyUpdate,
  TInitiativeComplete,
  TStrategyBacklogItem,
  TDecisionProposalInput,
  TDecisionPositionInput,
} from '@TDM/types'

import { EStance, EDecisionAxis } from '@TDM/types'

/** Fence label — CEO writes / updates the org Company Strategy. */
export const StrategyBlockFence = `tdsk-strategy`

/** Fence label — open a board decision proposal. */
export const DecisionsBlockFence = `tdsk-decisions`

/** Fence label — post a per-round board position. */
export const DecisionPositionsBlockFence = `tdsk-decision-positions`

/** Fence label — CTO reports an Active Initiative delivered. */
export const InitiativeCompleteBlockFence = `tdsk-initiative-complete`

/** Maximum characters of Company Strategy context injected into a cycle prompt. */
export const StrategyInjectMaxChars = 8000

/** Maximum characters of Business metrics context injected into an exec cycle prompt. */
export const BusinessMetricsInjectMaxChars = 4000

// ─── fenced-block helpers (module-private) ──────────────────────────────────────

/** Extract the content of the LAST fenced ```{fence}``` block, or undefined. */
const lastFencedBlock = (text: string, fence: string): string | undefined => {
  const fenceRegex = new RegExp(`\`\`\`${fence}\\s*\\n([\\s\\S]*?)\`\`\``, `g`)
  let last: string | undefined
  for (const match of text.matchAll(fenceRegex)) last = match[1]
  return last
}

/** Parse a JSON array out of a fenced block; non-array / malformed → null. */
const parseJsonArray = (block: string): unknown[] | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(block)
  } catch {
    return null
  }
  return Array.isArray(parsed) ? parsed : null
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === `string` && value.trim().length > 0

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === `string`) : []

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === `number` && Number.isFinite(value)

const ValidAxes = new Set<string>(Object.values(EDecisionAxis))
const ValidStances = new Set<string>(Object.values(EStance))

// ─── parsers ────────────────────────────────────────────────────────────────

/**
 * Read the LAST ```{DecisionsBlockFence}``` block and return validated
 * decision-proposal inputs. Entries missing a non-empty title / description or a
 * valid axis are dropped. `evidence` is optional and coerced to a string array.
 * Missing block / non-array payload / malformed JSON → [].
 */
export const parseDecisionsBlock = (text: string): TDecisionProposalInput[] => {
  if (!text) return []
  const block = lastFencedBlock(text, DecisionsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block)
  if (!parsed) return []

  const entries: TDecisionProposalInput[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>

    if (!nonEmptyString(item.title) || !nonEmptyString(item.description)) continue
    if (!nonEmptyString(item.axis) || !ValidAxes.has(item.axis)) continue

    const entry: TDecisionProposalInput = {
      title: item.title.trim(),
      axis: item.axis as TDecisionProposalInput[`axis`],
      description: item.description.trim(),
    }

    if (Array.isArray(item.evidence)) entry.evidence = stringArray(item.evidence)

    entries.push(entry)
  }

  return entries
}

/**
 * Read the LAST ```{DecisionPositionsBlockFence}``` block and return validated
 * per-round board positions. Entries missing a non-empty proposalId / reasoning or
 * a valid stance are dropped. Missing block / malformed JSON → [].
 */
export const parseDecisionPositionsBlock = (text: string): TDecisionPositionInput[] => {
  if (!text) return []
  const block = lastFencedBlock(text, DecisionPositionsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block)
  if (!parsed) return []

  const entries: TDecisionPositionInput[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>

    if (!nonEmptyString(item.proposalId) || !nonEmptyString(item.reasoning)) continue
    if (!nonEmptyString(item.stance) || !ValidStances.has(item.stance)) continue

    entries.push({
      proposalId: item.proposalId.trim(),
      stance: item.stance as TDecisionPositionInput[`stance`],
      reasoning: item.reasoning.trim(),
    })
  }

  return entries
}

/** Validate a single backlog item; malformed → null. */
const parseBacklogItem = (raw: unknown): TStrategyBacklogItem | null => {
  if (!raw || typeof raw !== `object`) return null
  const item = raw as Record<string, unknown>
  if (!nonEmptyString(item.title) || !nonEmptyString(item.rationale)) return null
  if (!isFiniteNumber(item.priority)) return null
  return {
    title: item.title.trim(),
    rationale: item.rationale.trim(),
    priority: item.priority,
  }
}

/**
 * Read the LAST ```{StrategyBlockFence}``` block and return validated Company
 * Strategy updates. Each entry keeps only the recognized, correctly-typed fields
 * (northStar / segments / positioning / backlog); an entry carrying none of them
 * is dropped. Malformed backlog items are dropped individually. Missing block /
 * malformed JSON → [].
 */
export const parseStrategyBlock = (text: string): TStrategyUpdate[] => {
  if (!text) return []
  const block = lastFencedBlock(text, StrategyBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block)
  if (!parsed) return []

  const entries: TStrategyUpdate[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>

    const update: TStrategyUpdate = {}
    let hasField = false

    if (nonEmptyString(item.northStar)) {
      update.northStar = item.northStar.trim()
      hasField = true
    }
    if (Array.isArray(item.segments)) {
      update.segments = stringArray(item.segments)
      hasField = true
    }
    if (nonEmptyString(item.positioning)) {
      update.positioning = item.positioning.trim()
      hasField = true
    }
    if (Array.isArray(item.backlog)) {
      update.backlog = item.backlog
        .map(parseBacklogItem)
        .filter((b): b is TStrategyBacklogItem => b !== null)
      hasField = true
    }

    if (hasField) entries.push(update)
  }

  return entries
}

/**
 * Read the LAST ```{InitiativeCompleteBlockFence}``` block and return validated
 * initiative-complete reports. Entries missing a non-empty initiativeTitle or an
 * evidenceRefs array are dropped; evidenceRefs is coerced to a string array.
 * Missing block / malformed JSON → [].
 */
export const parseInitiativeCompleteBlock = (text: string): TInitiativeComplete[] => {
  if (!text) return []
  const block = lastFencedBlock(text, InitiativeCompleteBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block)
  if (!parsed) return []

  const entries: TInitiativeComplete[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>

    if (!nonEmptyString(item.initiativeTitle)) continue
    if (!Array.isArray(item.evidenceRefs)) continue

    entries.push({
      initiativeTitle: item.initiativeTitle.trim(),
      evidenceRefs: stringArray(item.evidenceRefs),
    })
  }

  return entries
}
