import type { TVerifyProbe, TVerifyResult } from '@tdsk/domain'

import {
  DefaultVerifyProbe,
  EVerifyProbeKind,
  VerifyDeclareBlockFence,
  VerifyResultsBlockFence,
} from '@tdsk/domain'

import { lastFencedBlock, parseJsonArray, nonEmptyString } from './skill'

const ValidProbeKinds = new Set<string>(Object.values(EVerifyProbeKind))

/**
 * Read the LAST tdsk-verify block from a PR body and coerce it to a TVerifyProbe.
 * The block content is a single JSON object; malformed/missing → DefaultVerifyProbe.
 * Be lenient: also accepts an array whose first entry has the probe shape.
 */
export const probeFromPrBody = (body: string): TVerifyProbe => {
  const raw = lastFencedBlock(body, VerifyDeclareBlockFence)
  if (!raw) return DefaultVerifyProbe

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DefaultVerifyProbe
  }

  // Accept `{kind, params?}` OR an array whose first entry has that shape.
  const obj = Array.isArray(parsed) ? parsed[0] : parsed
  if (!obj || typeof obj !== `object`) return DefaultVerifyProbe

  const kind = (obj as any).kind
  if (typeof kind !== `string` || !ValidProbeKinds.has(kind)) return DefaultVerifyProbe

  const params = (obj as any).params
  return {
    kind: kind as TVerifyProbe[`kind`],
    ...(params && typeof params === `object` ? { params } : {}),
  }
}

/**
 * Read the LAST tdsk-verify-results block from runtime-brain stdout and return
 * validated TVerifyResult entries. Each entry requires:
 *   - prNumber: a positive integer (coerced via Number() — string digits accepted)
 *   - status: exactly 'verified' or 'regressed'
 * Optional fields (mergeSha, detail, revertPrUrl) are only included when non-empty.
 * Malformed block or missing block → [].
 */
export const parseVerifyResultsBlock = (text: string): TVerifyResult[] => {
  if (!text) return []

  const block = lastFencedBlock(text, VerifyResultsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, VerifyResultsBlockFence)
  if (!parsed) return []

  const out: TVerifyResult[] = []
  for (const item of parsed) {
    if (!item || typeof item !== `object`) continue

    const prNumber = Number((item as any).prNumber)
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue

    const status = (item as any).status
    if (status !== `verified` && status !== `regressed`) continue

    const entry: TVerifyResult = { prNumber, status }

    if (nonEmptyString((item as any).mergeSha)) entry.mergeSha = (item as any).mergeSha
    if (nonEmptyString((item as any).detail)) entry.detail = (item as any).detail
    if (nonEmptyString((item as any).revertPrUrl))
      entry.revertPrUrl = (item as any).revertPrUrl

    out.push(entry)
  }

  return out
}
