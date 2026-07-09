import type { TMemoryKind, TMemoryWriteInput } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import {
  EMemoryKind,
  MemoriesBlockFence,
  MemoryMaxTextChars,
  MemoryMaxImportance,
  MemoryMinImportance,
} from '@tdsk/domain'

/** Default importance applied when a memory write omits one (matches the model default). */
export const MemoryDefaultImportance = 5

/** Escape a value for embedding inside a single-quoted shell argument. */
const escapeShellSingleQuote = (value: string): string => value.replace(/'/g, `'\\''`)

/**
 * Build an inline `env KEY='VAL' KEY2='VAL2'` prefix that overrides pod-default
 * environment variables for a single command invocation. Each value is
 * single-quoted with embedded single quotes escaped, so URLs and placeholder
 * tokens pass through verbatim (immune to shell word-splitting/expansion). An
 * empty env map yields an empty string, so the caller runs the bare command.
 */
export const buildEnvPrefix = (env: Record<string, string>): string => {
  const parts = Object.entries(env).map(
    ([key, value]) => `${key}='${escapeShellSingleQuote(value)}'`
  )
  return parts.length ? `env ${parts.join(` `)}` : ``
}

/** Clamp an importance value into the [min, max] range, rounding to an integer. */
export const clampImportance = (value: number): number =>
  Math.min(MemoryMaxImportance, Math.max(MemoryMinImportance, Math.round(value)))

/** Truncate memory text to the maximum allowed characters. */
export const truncateMemoryText = (text: string): string =>
  text.length > MemoryMaxTextChars ? text.slice(0, MemoryMaxTextChars) : text

const ValidMemoryKinds = new Set<string>(Object.values(EMemoryKind))

/**
 * Parse the LAST fenced ```{MemoriesBlockFence}``` block out of runtime stdout
 * and return the validated, clamped memory-write entries it carries. A missing
 * block, a non-array payload, or malformed JSON yields an empty array (no-op).
 * Multiple blocks → the last one wins. Entries without a non-empty text string
 * are dropped; importance is clamped (defaulted when absent) and kind is kept
 * only when it is a recognized EMemoryKind.
 */
export const parseMemoryBlock = (text: string): TMemoryWriteInput[] => {
  if (!text) return []

  const fenceRegex = new RegExp(
    `\`\`\`${MemoriesBlockFence}\\s*\\n([\\s\\S]*?)\`\`\``,
    `g`
  )

  let lastBlock: string | undefined
  for (const match of text.matchAll(fenceRegex)) lastBlock = match[1]
  if (lastBlock === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(lastBlock)
  } catch {
    logger.debug(`[memory] Ignoring malformed tdsk-memories block`)
    return []
  }

  if (!Array.isArray(parsed)) return []

  const entries: TMemoryWriteInput[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (typeof item.text !== `string` || item.text.trim().length === 0) continue

    const entry: TMemoryWriteInput = {
      text: truncateMemoryText(item.text),
      importance: clampImportance(
        typeof item.importance === `number` ? item.importance : MemoryDefaultImportance
      ),
    }
    if (typeof item.kind === `string` && ValidMemoryKinds.has(item.kind))
      entry.kind = item.kind as TMemoryKind
    if (item.meta && typeof item.meta === `object`)
      entry.meta = item.meta as Record<string, any>

    entries.push(entry)
  }

  return entries
}
