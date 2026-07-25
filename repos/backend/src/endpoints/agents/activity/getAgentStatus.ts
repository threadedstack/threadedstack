import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EQueryOp, EPermAction, EPermResource } from '@tdsk/domain'

import { assertAgentInScope } from './assertAgentInScope'
import { toRedactedActivityRecord } from './toRedactedActivityRecord'

/**
 * The heartbeat collection the resident runtime upserts every ~30s. Mirrors
 * `ResidentStatusCollectionName` in the seed that creates it, the same way the
 * watchdog and the allowlist resolver mirror their own collection names.
 */
const ResidentStatusCollection = `resident_status`

/**
 * GET /:orgId/projects/:projectId/agents/:agentId/activity/status
 *
 * The agent's current liveness: session, queue depth, current activity, turn
 * count, last turn time, and the watchdog-owned `degraded` flag.
 *
 * Returns `data: null` when the agent has never run. That is the normal state
 * for a scheduled (non-resident) agent, so it is not an error.
 *
 * Deliberately passes no `orderBy`: `resident_status` declares no timestamp
 * field, and the query compiler throws on a field the collection schema does
 * not declare. The heartbeat keeps exactly one record per agent (keyed by
 * `agentId`), so the record service's `createdAt DESC` fallback is both correct
 * and deterministic here.
 *
 * Requires BOTH `agent:read` and `collection:read`, because the body is the raw
 * `resident_status` document — the same bytes the generic collection query route
 * returns behind `collection:read`. See `listAgentTurns` for the full rationale.
 *
 * The document IS run through `redactSecrets`, like the three list endpoints.
 * The declared heartbeat schema looks harmless — `agentId`, `sessionId`,
 * `queueDepth`, `currentActivity`, `lastTurnAt`, `turnCount`, `degraded` — but
 * it is NOT a closed set, so "there is no free text here" is not a property this
 * endpoint can rely on:
 *
 * - The record service's `#validateData` walks only the fields the schema
 *   DECLARES. It rejects a wrong type and a missing required field, and it never
 *   strips an undeclared key, so an arbitrary key holding arbitrary text is
 *   stored exactly as written.
 * - The heartbeat Function spreads `...prev` over the previous record on every
 *   beat so the watchdog-owned `degraded` flag survives, which also means a key
 *   injected once is re-emitted by every later beat.
 * - `currentActivity` is agent-authored rather than a platform constant: the
 *   resident loop builds it from its own config, which the agent evolves via
 *   `updateResidentConfig`.
 *
 * Redacting seven short fields costs nothing measurable, so this endpoint does
 * not depend on that schema staying shut.
 */
export const getAgentStatus: TEndpointConfig = {
  path: `/status`,
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
      ResidentStatusCollection,
      {
        where: [{ field: `agentId`, op: EQueryOp.eq, value: agentId }],
        limit: 1,
      }
    )
    if (error) throw new Exception(500, error.message)

    const row = data?.[0]
    res.status(200).json({ data: row ? toRedactedActivityRecord(row) : null })
  },
}
