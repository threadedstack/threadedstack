import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TTaskProposalInput } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { authorTaskProposal } from '@TBE/utils/agent/taskPromotion'
import {
  coercePriority,
  coerceSourceSignal,
  deriveDedupeKey,
} from '@TBE/utils/agent/task'

/**
 * POST /:orgId/task-proposals - Author a task proposal directly.
 * Runs the deterministic security scan at author time (via authorTaskProposal):
 * a scan pass lands the proposal as `scanned`, a scan failure lands it as
 * `rejected` (still created and returned normally, never a 500). Dedupes
 * against any still-open proposal for the same dedupeKey, returning the
 * existing row with `deduped: true` (200) instead of a fresh one (201).
 */
export const createTaskProposal: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.taskProposal)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params
    const {
      agentId,
      title,
      description,
      evidence,
      priority,
      sourceSignal,
      dedupeKey,
      repos,
      initiative,
      parentId,
      meta,
    } = req.body

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (typeof agentId !== `string` || agentId.trim().length === 0)
      throw new Exception(400, `agentId is required`)
    if (typeof title !== `string` || title.trim().length === 0)
      throw new Exception(400, `title is required`)
    if (typeof description !== `string` || description.trim().length === 0)
      throw new Exception(400, `description is required`)
    if (typeof evidence !== `string` || evidence.trim().length === 0)
      throw new Exception(400, `evidence is required`)

    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
    if (agentErr) throw new Exception(500, agentErr.message)
    if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    const cleanTitle = title.trim()
    const signal = coerceSourceSignal(sourceSignal)
    const metaObj =
      meta && typeof meta === `object` ? (meta as Record<string, any>) : undefined

    const input: TTaskProposalInput = {
      title: cleanTitle,
      description: description.trim(),
      evidence: evidence.trim(),
      priority: coercePriority(priority),
      sourceSignal: signal,
      dedupeKey:
        typeof dedupeKey === `string` && dedupeKey.trim().length > 0
          ? dedupeKey.trim()
          : deriveDedupeKey(signal, cleanTitle),
      repos:
        Array.isArray(repos) && repos.every((r) => typeof r === `string`)
          ? repos
          : undefined,
      parentId:
        typeof parentId === `string` && parentId.trim().length > 0
          ? parentId.trim()
          : undefined,
      initiative:
        typeof initiative === `string` && initiative.trim().length > 0
          ? initiative.trim()
          : undefined,
      meta: metaObj,
    }

    const { id, deduped } = await authorTaskProposal(db, orgId, agentId, input, metaObj)

    const { data, error } = await db.services.taskProposal.get(id)
    if (error) throw new Exception(500, error.message)

    res.status(deduped ? 200 : 201).json({ data, deduped })
  },
}
