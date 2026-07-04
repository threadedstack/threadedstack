import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getAgent } from '@TBE/endpoints/agents/getAgent'
import { runAgent } from '@TBE/endpoints/agents/runAgent'
import { listAgents } from '@TBE/endpoints/agents/listAgents'
import { agentThreads } from '@TBE/endpoints/threads/threads'
import { createAgent } from '@TBE/endpoints/agents/createAgent'
import { updateAgent } from '@TBE/endpoints/agents/updateAgent'
import { deleteAgent } from '@TBE/endpoints/agents/deleteAgent'
import { agentMemories } from '@TBE/endpoints/memories/memories'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

export const orgAgents: TEndpointConfig = {
  path: `/:orgId/agents`,
  method: EPMethod.Use,
  middleware: [featureGate(`agents`), projectAccessGuard()],
  endpoints: {
    getAgent,
    runAgent,
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    agentThreads,
    agentMemories,
  },
}
