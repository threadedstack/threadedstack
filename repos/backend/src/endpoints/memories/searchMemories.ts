import type { Response } from 'express'
import type { TMemoryKind } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/agents/:agentId/memories/search - Scored memory retrieval.
 * Embeds the query (null-safe → lexical fallback) then runs searchScored.
 */
export const searchMemories: TEndpointConfig = {
  path: `/search`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.read, EPermResource.memory)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, embeddings } = req.app.locals
    const { orgId, agentId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
    if (agentErr) throw new Exception(500, agentErr.message)
    if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    const { query, limit, kinds } = req.body
    if (query !== undefined && typeof query !== `string`)
      throw new Exception(400, `query must be a string`)

    const queryEmbedding = query
      ? ((await embeddings?.embedOne(query, { orgId })) ?? undefined)
      : undefined

    const { data, error } = await db.services.memory.searchScored({
      orgId,
      agentId,
      query,
      queryEmbedding,
      limit: typeof limit === `number` ? limit : undefined,
      kinds: Array.isArray(kinds) ? (kinds as TMemoryKind[]) : undefined,
    })

    if (error) throw new Exception(500, error.message)

    res.json({ data: data || [] })
  },
}
