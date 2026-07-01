import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getAgent } from '@TBE/endpoints/agents/getAgent'
import { runAgent } from '@TBE/endpoints/agents/runAgent'
import { oaiModels } from '@TBE/endpoints/agents/oaiModels'
import { listAgents } from '@TBE/endpoints/agents/listAgents'
import { createAgent } from '@TBE/endpoints/agents/createAgent'
import { updateAgent } from '@TBE/endpoints/agents/updateAgent'
import { deleteAgent } from '@TBE/endpoints/agents/deleteAgent'
import { oaiChatCompletions } from '@TBE/endpoints/agents/oaiChatCompletions'

/**
 * Full agents aggregator. Used by unit tests for convenient access to every
 * agent endpoint config. It is intentionally NOT registered in `accounts.ts`.
 *
 * CRUD/run are served org-scoped via `orgAgents` (`/_/orgs/:orgId/agents`),
 * where `authorize` validates membership against the URL's org. The org-less
 * top-level mount previously registered here let `createAgent` trust
 * `agent.orgId` from the request body while `authorize` checked the header
 * org — a cross-org vector. Only the OpenAI-compatible routes must be
 * org-less (an OpenAI client's base_url cannot carry an `:orgId` segment), so
 * those alone are exposed live via `agentOaiRoutes` below. Both OAI routes
 * enforce access against the agent's real DB org via `requireAgentAccess`.
 */
export const agents: TEndpointConfig = {
  path: `/agents`,
  method: EPMethod.Use,
  middleware: [featureGate(`agents`)],
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

/**
 * Live top-level mount: OpenAI-compatible routes only. These MUST be org-less
 * so `base_url = <host>/_/agents/<id>/v1` works for OpenAI SDK clients. Both
 * endpoints gate on the agent's real org via `requireAgentAccess`.
 */
export const agentOaiRoutes: TEndpointConfig = {
  path: `/agents`,
  method: EPMethod.Use,
  middleware: [featureGate(`agents`)],
  endpoints: {
    oaiModels,
    oaiChatCompletions,
  },
}
