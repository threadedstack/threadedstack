import type { TActivityRecord, TAgentStatus } from '@TAF/types/agentActivity.types'

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
