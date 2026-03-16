import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getAgent } from '@TBE/endpoints/agents/getAgent'
import { listAgents } from '@TBE/endpoints/agents/listAgents'
import { createAgent } from '@TBE/endpoints/agents/createAgent'
import { updateAgent } from '@TBE/endpoints/agents/updateAgent'
import { deleteAgent } from '@TBE/endpoints/agents/deleteAgent'
import { runAgent } from '@TBE/endpoints/agents/runAgent'
import { oaiChatCompletions } from '@TBE/endpoints/agents/oaiChatCompletions'
import { oaiModels } from '@TBE/endpoints/agents/oaiModels'

export const agents: TEndpointConfig = {
  path: `/agents`,
  method: EPMethod.Use,
  endpoints: {
    getAgent,
    runAgent,
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    oaiChatCompletions,
    oaiModels,
  },
}
