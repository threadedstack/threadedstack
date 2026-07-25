import type { Record as RecordModel } from '@tdsk/domain'

/**
 * The wire shape of one activity record: the record id, its JSON document, and
 * the row's creation time.
 *
 * `createdAt` is included because `agent_messages` documents carry no timestamp
 * of their own — the seed schema is `{ to, from, subject, body, refs, readAt }`
 * — so the row's creation time is the only value a client can order a merged
 * timeline by. The internal scoping columns (`collectionId`, `projectId`) are
 * deliberately dropped: they are storage detail, and nothing outside the
 * backend should key on them.
 */
export const toActivityRecord = (row: RecordModel) => ({
  id: row.id,
  data: row.data,
  createdAt: row.createdAt,
})
