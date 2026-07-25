import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

import { assertAgentInScope } from './assertAgentInScope'
import { toActivityRecord } from './toActivityRecord'
import { resolveActivityQuery } from './resolveActivityQuery'

/** One append-only row per completed turn, written by `appendTranscript`. */
const ResidentTranscriptsCollection = `resident_transcripts`

/**
 * GET /:orgId/projects/:projectId/agents/:agentId/activity/turns
 *
 * The agent's recent turns, newest first, keyset-paged on `at` via `before`.
 * Each row carries the trigger `event` plus the turn's `input`/`output`, which
 * the writer tail-caps at 20k characters — a client marks a value at that cap
 * as truncated rather than implying it is the full turn.
 */
export const listAgentTurns: TEndpointConfig = {
  path: `/turns`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params
    const agentId = await assertAgentInScope(req)

    const { data, error } = await db.services.record.query(
      projectId,
      ResidentTranscriptsCollection,
      resolveActivityQuery(agentId, req.query, {
        agentField: `agentId`,
        timeField: `at`,
      })
    )
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: (data ?? []).map(toActivityRecord) })
  },
}
