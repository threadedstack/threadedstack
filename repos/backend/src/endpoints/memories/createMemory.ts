import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Memory, EMemoryKind, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import {
  clampImportance,
  truncateMemoryText,
  MemoryDefaultImportance,
} from '@TBE/utils/agent/memory'

const ValidKinds = new Set<string>(Object.values(EMemoryKind))

/**
 * POST /:orgId/agents/:agentId/memories - Create a memory for an agent.
 * Importance is clamped, text truncated, and an embedding backfilled (null-safe).
 */
export const createMemory: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.memory)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, embeddings } = req.app.locals
    const { orgId, agentId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)

    const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
    if (agentErr) throw new Exception(500, agentErr.message)
    if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)

    const { text, kind, importance, meta } = req.body
    if (typeof text !== `string` || text.trim().length === 0)
      throw new Exception(400, `text is required`)
    if (kind !== undefined && !ValidKinds.has(kind))
      throw new Exception(400, `Invalid memory kind: ${kind}`)

    const cleanText = truncateMemoryText(text)
    const embedding = (await embeddings?.embedOne(cleanText, { orgId })) ?? null

    const memory = new Memory({
      orgId,
      agentId,
      embedding,
      text: cleanText,
      meta: meta ?? null,
      kind: kind ?? EMemoryKind.fact,
      importance: clampImportance(
        typeof importance === `number` ? importance : MemoryDefaultImportance
      ),
    })

    const { data, error } = await db.services.memory.create(memory)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
