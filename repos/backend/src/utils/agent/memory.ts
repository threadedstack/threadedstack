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

/** Additional attempts after the first when a runtime run hits a transient upstream error. */
export const CliMaxTransientRetries = 2

/** Backoff (ms) before each transient retry, indexed by attempt (0-based). */
export const CliTransientRetryDelaysMs = [5000, 15000]

/**
 * Same-provider transient retries to spend BEFORE failing over to the next
 * provider in the chain. Kept low (1) so a dead provider doesn't burn the full
 * transient-retry budget when a healthy fallback is available; the terminal
 * provider (no fallbacks left) still exhausts CliMaxTransientRetries.
 */
export const CliSameProviderRetriesBeforeFailover = 1

/**
 * Safety cap on how many fallback providers the runtime brain will advance
 * through in one cycle. Set generously above any realistic provider-list length
 * so it never limits below the number of configured fallbacks.
 */
export const CliMaxProviderFailovers = 8

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

/**
 * Transient upstream failure signal — 5xx status codes, "Overloaded"/529, and
 * rate-limit language returned by the CLI brain when its LLM provider is
 * temporarily unavailable. No `g` flag, so it is safe for both `.test` and
 * `.match` (no shared lastIndex).
 */
const TransientUpstreamRegex =
  /\b529\b|overloaded|API Error:\s*5\d\d|rate.?limit|\b503\b|\b502\b|500 Internal/i

/** Return the first matched transient-upstream signal in `text`, if any. */
export const matchTransientSignal = (text: string): string | undefined => {
  if (!text) return undefined
  return text.match(TransientUpstreamRegex)?.[0]
}

/** Clamp an importance value into the [min, max] range, rounding to an integer. */
export const clampImportance = (value: number): number =>
  Math.min(MemoryMaxImportance, Math.max(MemoryMinImportance, Math.round(value)))

/** Truncate memory text to the maximum allowed characters. */
export const truncateMemoryText = (text: string): string =>
  text.length > MemoryMaxTextChars ? text.slice(0, MemoryMaxTextChars) : text

const ValidMemoryKinds = new Set<string>(Object.values(EMemoryKind))

/**
 * Detect a transient upstream failure signal in captured output — 5xx status
 * codes, "Overloaded"/529, and rate-limit language returned by the CLI brain
 * when its LLM provider is temporarily unavailable. Used to decide whether a
 * failed runtime run is worth retrying in the same pod.
 */
export const isTransientUpstreamFailure = (text: string): boolean => {
  if (!text) return false
  return TransientUpstreamRegex.test(text)
}

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
