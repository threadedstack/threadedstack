import type { Record as RecordModel } from '@tdsk/domain'

import { redactSecrets } from '@TBE/utils/redactSecrets'

import { toActivityRecord } from './toActivityRecord'

/**
 * `toActivityRecord` with secret-shaped substrings stripped out of the document.
 *
 * Used by every collection whose rows carry agent-authored FREE TEXT — turn
 * `input`/`output`, message `body`, memory `text` — because that is where a
 * credential the agent was handling can land verbatim. `resident_status` is
 * mapped without it: the heartbeat is a fixed set of counters and flags with no
 * free-text field, so there is nothing for the pattern to match and no reason to
 * spend the walk.
 *
 * Only `data` is redacted. `id` and `createdAt` are backend-generated and can
 * never hold a caller's secret, and rewriting an `id` would break the `before`
 * cursor a client pages with.
 */
export const toRedactedActivityRecord = (row: RecordModel) => ({
  ...toActivityRecord(row),
  data: redactSecrets(row.data),
})
