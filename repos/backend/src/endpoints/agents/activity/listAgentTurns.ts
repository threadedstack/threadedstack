import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

import { assertAgentInScope } from './assertAgentInScope'
import { resolveActivityQuery } from './resolveActivityQuery'
import { toRedactedActivityRecord } from './toRedactedActivityRecord'

/** One append-only row per completed turn, written by `appendTranscript`. */
const ResidentTranscriptsCollection = `resident_transcripts`

/**
 * GET /:orgId/projects/:projectId/agents/:agentId/activity/turns
 *
 * The agent's recent turns, newest first, keyset-paged on `at` via `before`.
 * Each row carries the trigger `event` plus the turn's `input`/`output`, which
 * the writer tail-caps at 20k characters — a client marks a value at that cap
 * as truncated rather than implying it is the full turn.
 *
 * Requires BOTH `agent:read` and `collection:read`. The response body is the raw
 * `resident_transcripts` document, the same bytes `POST .../collections/
 * resident_transcripts/records/query` returns, and that route requires
 * `collection:read`. Demanding only `agent:read` would make this endpoint a way
 * around a revoked collection grant, since `resolveEffectivePermissions`
 * intersects permission overrides and API-key permissions: a key minted with
 * only `agent:read` must not read collection documents here.
 */
export const listAgentTurns: TEndpointConfig = {
  path: `/turns`,
  method: EPMethod.Get,
  middleware: [
    authorize(EPermAction.read, EPermResource.agent),
    authorize(EPermAction.read, EPermResource.collection),
  ],
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

    res.status(200).json({ data: (data ?? []).map(toRedactedActivityRecord) })
  },
}
