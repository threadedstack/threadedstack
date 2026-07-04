import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/agents/:agentId/memories/reembed - Re-embed memory rows that
 * have no embedding yet (embedding IS NULL). Self-healing maintenance: backfills
 * rows created while no embedding provider was reachable, and rows left NULL
 * after an embedding-dimension/model change. Null-safe — rows that still fail to
 * embed (no provider) are left NULL and simply not counted.
 */
export const reembedMemories: TEndpointConfig = {
  path: `/reembed`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.update, EPermResource.memory)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, embeddings } = req.app.locals
    const { orgId, agentId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
    if (agentErr) throw new Exception(500, agentErr.message)
    if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    const { data: rows, error } = await db.services.memory.listUnembedded(orgId, agentId)
    if (error) throw new Exception(500, error.message)

    const pending = rows || []
    let reembedded = 0

    for (const memory of pending) {
      const embedding = (await embeddings?.embedOne(memory.text, { orgId })) ?? null
      if (!embedding) continue

      const { error: updErr } = await db.services.memory.update({
        id: memory.id,
        embedding,
      } as any)
      if (updErr) throw new Exception(500, updErr.message)
      reembedded += 1
    }

    res.json({ data: { total: pending.length, reembedded } })
  },
}
