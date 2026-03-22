import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getAgent } from '@TBE/endpoints/agents/getAgent'
import { runAgent } from '@TBE/endpoints/agents/runAgent'
import { oaiModels } from '@TBE/endpoints/agents/oaiModels'
import { listAgents } from '@TBE/endpoints/agents/listAgents'
import { createAgent } from '@TBE/endpoints/agents/createAgent'
import { updateAgent } from '@TBE/endpoints/agents/updateAgent'
import { deleteAgent } from '@TBE/endpoints/agents/deleteAgent'
import { oaiChatCompletions } from '@TBE/endpoints/agents/oaiChatCompletions'

export const agents: TEndpointConfig = {
  path: `/agents`,
  method: EPMethod.Use,
  endpoints: {
    getAgent,
    runAgent,
    oaiModels,
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    oaiChatCompletions,
  },
}
