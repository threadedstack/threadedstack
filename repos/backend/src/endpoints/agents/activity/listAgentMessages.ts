import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

import { assertAgentInScope } from './assertAgentInScope'
import { toActivityRecord } from './toActivityRecord'
import { resolveActivityQuery } from './resolveActivityQuery'

/** Inter-agent mail, written by `sendAgentMessage`. */
const AgentMessagesCollection = `agent_messages`

/**
 * GET /:orgId/projects/:projectId/agents/:agentId/activity/messages
 *
 * The agent's inbox, newest first, paged by `offset`.
 *
 * Two shape differences from turns and memories, both forced by the collection
 * schema `{ to, from, subject, body, refs, readAt }`:
 *
 * 1. Rows carry NO `agentId`, so they are addressed by recipient (`to`).
 *    Filtering on `agentId` would make the query compiler throw, turning every
 *    read into a 500.
 * 2. Rows carry no timestamp, so there is nothing to keyset on. The read falls
 *    back to the record row's own `createdAt DESC` and pages by `offset`, and
 *    the response's `createdAt` is what a client orders a merged timeline by.
 */
export const listAgentMessages: TEndpointConfig = {
  path: `/messages`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params
    const agentId = await assertAgentInScope(req)

    const { data, error } = await db.services.record.query(
      projectId,
      AgentMessagesCollection,
      resolveActivityQuery(agentId, req.query, { agentField: `to` })
    )
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: (data ?? []).map(toActivityRecord) })
  },
}
