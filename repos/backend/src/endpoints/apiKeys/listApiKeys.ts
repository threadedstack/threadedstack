import type { Response } from 'express'
import type { ApiKey } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /api-keys - List all API keys (masked)
 * Requires admin+ role in the org or project
 */
export const listApiKeys: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.apiKey)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params
    const { projectId, userId } = req.query
    const rawActive = Array.isArray(req.query.active)
      ? req.query.active[0]
      : req.query.active
    const active = rawActive !== undefined ? rawActive === `true` : true

    // Require orgId — keys are listed under /orgs/:orgId even when project-scoped (exclusive arc)
    if (!orgId) throw new Exception(400, `orgId parameter required`)

    const { limit, offset } = parsePagination(req)

    const where: Record<string, string | boolean> = { active }
    if (projectId) {
      // When listing project-scoped keys, filter by projectId only (orgId is null on these keys)
      where.projectId = projectId as string
    } else {
      // When listing org-scoped keys, filter by orgId
      where.orgId = orgId
    }
    if (userId) where.userId = userId as string

    const { data, error } = await db.services.apiKey.list({ where, limit, offset })

    if (error) throw new Exception(500, error.message)

    const sanitizedData = (data || []).map((apiKey: ApiKey) => apiKey.sanitize())

    res.status(200).json({ data: sanitizedData, limit, offset })
  },
}
