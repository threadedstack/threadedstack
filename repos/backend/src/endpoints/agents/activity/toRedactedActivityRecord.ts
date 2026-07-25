import type { Record as RecordModel } from '@tdsk/domain'

import { redactSecrets } from '@TBE/utils/redactSecrets'

import { toActivityRecord } from './toActivityRecord'

/**
 * `toActivityRecord` with secret-shaped substrings stripped out of the document.
 *
 * Used by ALL FOUR activity endpoints. The obvious targets are the collections
 * carrying agent-authored free text — turn `input`/`output`, message `body`,
 * memory `text` — because that is where a credential the agent was handling can
 * land verbatim. `resident_status` goes through it too: its declared schema is
 * counters and flags, but the record service never strips undeclared keys and
 * the heartbeat re-emits whatever it finds, so the absence of free text there is
 * a convention rather than something the storage layer enforces. Applying the
 * walk everywhere means no endpoint depends on that convention holding.
 *
 * Only `data` is redacted. `id` and `createdAt` are backend-generated and can
 * never hold a caller's secret, and rewriting an `id` would break the `before`
 * cursor a client pages with.
 */
export const toRedactedActivityRecord = (row: RecordModel) => ({
  ...toActivityRecord(row),
  data: redactSecrets(row.data),
})
