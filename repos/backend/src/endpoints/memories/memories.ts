import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getMemory } from '@TBE/endpoints/memories/getMemory'
import { listMemories } from '@TBE/endpoints/memories/listMemories'
import { createMemory } from '@TBE/endpoints/memories/createMemory'
import { updateMemory } from '@TBE/endpoints/memories/updateMemory'
import { deleteMemory } from '@TBE/endpoints/memories/deleteMemory'
import { searchMemories } from '@TBE/endpoints/memories/searchMemories'
import { reembedMemories } from '@TBE/endpoints/memories/reembedMemories'

/**
 * Memories scoped under agents: /:orgId/agents/:agentId/memories
 * Search: POST .../memories/search
 * Gated by the `memories` feature flag.
 */
export const agentMemories: TEndpointConfig = {
  path: `/:agentId/memories`,
  method: EPMethod.Use,
  middleware: [featureGate(`memories`)],
  endpoints: {
    listMemories,
    createMemory,
    getMemory,
    updateMemory,
    deleteMemory,
    searchMemories,
    reembedMemories,
  },
}
