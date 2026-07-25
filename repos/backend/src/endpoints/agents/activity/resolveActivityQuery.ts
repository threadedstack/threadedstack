import type { TRecordQuery } from '@tdsk/domain'

import { EQueryOp } from '@tdsk/domain'

/** Page size when the caller does not ask for one. */
const DefaultLimit = 25

/**
 * Hard ceiling — the transcripts collection grows without bound, so an
 * unbounded read is never acceptable. Matches the record query compiler's own
 * `RecordQueryMaxLimit`, so a caller can never out-ask the storage layer.
 */
const MaxLimit = 100

/**
 * Hard ceiling on how deep a caller may page. `compileRecordQuery` clamps offset
 * only at the bottom (`Math.max(0, Math.floor(rawOffset))`), so without a
 * ceiling here an absurd offset reaches Postgres, where it either fails to cast
 * to bigint — a caller-triggerable 500 — or forces a full scan to skip rows that
 * do not exist. 100 pages of the maximum page size is far past any real inbox.
 */
const MaxOffset = 10000

/**
 * Parse a query-string integer and force it inside `[min, max]`.
 *
 * `Number` rather than `Number.parseInt`: `parseInt` reads an exponential string
 * by its leading digits alone (`1e21` -> `1`), which silently converts a hostile
 * bound into a plausible one instead of clamping it, and it happily accepts
 * trailing garbage (`50abc` -> `50`). An absent or unparseable value falls back
 * to `fallback`; everything else is floored and clamped, so no fractional,
 * negative, infinite, or out-of-range number can reach the query layer.
 */
const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const raw = String(value ?? ``).trim()
  if (!raw) return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback

  return Math.min(Math.max(Math.floor(parsed), min), max)
}

/**
 * Build the record query for an agent-activity read. Shared by the three list
 * endpoints so their filtering, ordering, and pagination cannot drift apart.
 *
 * Two collection shapes exist and the difference is load-bearing (see the
 * schemas in `repos/database/src/seeds/resident/collections.ts`):
 *
 * - `resident_transcripts` and `resident_memories` declare `agentId` + `at`, so
 *   they order and page on `at` with a keyset cursor. Keyset rather than offset
 *   because these collections are append-heavy: an offset page would shift
 *   under the reader as new turns land.
 * - `agent_messages` declares `{ to, from, subject, body, refs, readAt }` — it
 *   is addressed by recipient and carries NO timestamp at all. With no
 *   in-schema time field it cannot keyset, so it leaves `orderBy` unset (the
 *   record service then orders by the row's own `createdAt DESC`) and pages by
 *   offset.
 *
 * Naming a field the collection schema does not declare is not a silent empty
 * list: the query compiler throws on it and the read becomes a 500. That is why
 * `timeField` is omitted rather than defaulted.
 *
 * `limit` and `offset` are clamped at BOTH ends rather than trusted, and a
 * non-string `before` is dropped — Express parses a repeated query param into an
 * array, which must never reach the query layer as a bound value.
 */
export const resolveActivityQuery = (
  agentId: string,
  reqQuery: { limit?: unknown; before?: unknown; offset?: unknown },
  collection: { agentField: string; timeField?: string }
): TRecordQuery => {
  const limit = clampInt(reqQuery.limit, DefaultLimit, 1, MaxLimit)

  const where: TRecordQuery[`where`] = [
    { field: collection.agentField, op: EQueryOp.eq, value: agentId },
  ]

  const query: TRecordQuery = { where, limit }

  if (collection.timeField) {
    query.orderBy = { field: collection.timeField, direction: `desc` }

    if (typeof reqQuery.before === `string` && reqQuery.before)
      where.push({
        field: collection.timeField,
        op: EQueryOp.lt,
        value: reqQuery.before,
      })

    return query
  }

  query.offset = clampInt(reqQuery.offset, 0, 0, MaxOffset)

  return query
}
