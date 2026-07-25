import type { TAgentStatus, TActivityRecord } from '@TAF/types/agentActivity.types'
import type { Record as RecordModel } from '@tdsk/domain'

import { atomWithReset } from 'jotai/utils'

/**
 * Agent activity state, keyed by agentId so switching agents cannot show the
 * previous agent's turns.
 *
 * Every atom starts `undefined`, which means "not fetched yet" and renders a
 * skeleton. An empty object/array means "fetched, and there is nothing" and
 * renders an empty state. Collapsing those two would make a never-run agent
 * look like it is perpetually loading.
 */
export const agentStatusState =
  atomWithReset<Record<string, TAgentStatus | null>>(undefined)

export const agentTurnsState = atomWithReset<Record<string, TActivityRecord[]>>(undefined)

export const agentMessagesState =
  atomWithReset<Record<string, TActivityRecord[]>>(undefined)

export const agentMemoriesState =
  atomWithReset<Record<string, TActivityRecord[]>>(undefined)

/**
 * Records for the Collections browser, keyed `${projectId}:${collectionName}`.
 *
 * Populated on demand: a collection's records are only fetched when the user
 * opens that collection in the browser, never by the loader or the 5s poll.
 * `undefined` for a key means "not opened yet" (skeleton); `[]` means "opened
 * and the collection is empty" (empty state).
 */
export const collectionRecordsState =
  atomWithReset<Record<string, RecordModel[]>>(undefined)
