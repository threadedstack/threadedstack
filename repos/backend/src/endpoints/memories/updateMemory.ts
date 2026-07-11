import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TDBUpdate, TDBMemoryInsert } from '@tdsk/database'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EMemoryKind, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { clampImportance, truncateMemoryText } from '@TBE/utils/agent/memory'

const ValidKinds = new Set<string>(Object.values(EMemoryKind))

/**
 * PUT /:orgId/agents/:agentId/memories/:memoryId - Update a memory.
 * Only provided fields change; text edits re-embed (null-safe), importance clamps.
 */
export const updateMemory: TEndpointConfig = {
  path: `/:memoryId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.memory)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, embeddings } = req.app.locals
    const { orgId, agentId, memoryId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!agentId) throw new Exception(400, `agentId is required`)
    if (!memoryId) throw new Exception(400, `memoryId is required`)

    const { data: existing, error: getErr } = await db.services.memory.get(memoryId)
    if (getErr) throw new Exception(500, getErr.message)
    if (!existing || existing.orgId !== orgId || existing.agentId !== agentId)
      throw new Exception(404, `Memory not found`)

    const { text, kind, importance, meta } = req.body
    if (kind !== undefined && !ValidKinds.has(kind))
      throw new Exception(400, `Invalid memory kind: ${kind}`)

    const update: TDBUpdate<TDBMemoryInsert> = { id: memoryId }

    if (text !== undefined) {
      if (typeof text !== `string` || text.trim().length === 0)
        throw new Exception(400, `text must be a non-empty string`)
      const cleanText = truncateMemoryText(text)
      update.text = cleanText
      update.embedding = (await embeddings?.embedOne(cleanText, { orgId })) ?? null
    }
    if (kind !== undefined) update.kind = kind
    if (importance !== undefined) update.importance = clampImportance(Number(importance))
    if (meta !== undefined) update.meta = meta

    const { data, error } = await db.services.memory.update(update)
    if (error) throw new Exception(500, error.message)

    res.json({ data })
  },
}
