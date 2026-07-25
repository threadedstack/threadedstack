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
 * `limit` and `offset` are clamped rather than trusted, and a non-string
 * `before` is dropped — Express parses a repeated query param into an array,
 * which must never reach the query layer as a bound value.
 */
export const resolveActivityQuery = (
  agentId: string,
  reqQuery: { limit?: unknown; before?: unknown; offset?: unknown },
  collection: { agentField: string; timeField?: string }
): TRecordQuery => {
  const parsedLimit = Number.parseInt(String(reqQuery.limit ?? ``), 10)
  const limit = Number.isNaN(parsedLimit)
    ? DefaultLimit
    : Math.min(Math.max(parsedLimit, 1), MaxLimit)

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

  const parsedOffset = Number.parseInt(String(reqQuery.offset ?? ``), 10)
  query.offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0)

  return query
}
