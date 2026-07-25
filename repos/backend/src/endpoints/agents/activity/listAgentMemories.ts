import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

import { assertAgentInScope } from './assertAgentInScope'
import { toActivityRecord } from './toActivityRecord'
import { resolveActivityQuery } from './resolveActivityQuery'

/** Durable learnings, one append-only row per memory, written by `writeMemory`. */
const ResidentMemoriesCollection = `resident_memories`

/**
 * GET /:orgId/projects/:projectId/agents/:agentId/activity/memories
 *
 * The agent's durable memories, newest first, keyset-paged on `at` via
 * `before`. Each row carries the memory `text`, its `importance` (1-10), and an
 * optional `kind`/`meta` — the record of what the agent chose to remember
 * across compactions.
 */
export const listAgentMemories: TEndpointConfig = {
  path: `/memories`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params
    const agentId = await assertAgentInScope(req)

    const { data, error } = await db.services.record.query(
      projectId,
      ResidentMemoriesCollection,
      resolveActivityQuery(agentId, req.query, {
        agentField: `agentId`,
        timeField: `at`,
      })
    )
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: (data ?? []).map(toActivityRecord) })
  },
}
