import type { Response } from 'express'
import type { ApiKey } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /api-keys - List all API keys (masked)
 * Requires admin+ role in the org
 */
export const listApiKeys: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params
    const { projectId, userId } = req.query

    // Require orgId for API keys (they belong to orgs)
    if (!orgId) throw new Exception(400, `orgId parameter required`)

    // Check permission - requires admin+
    await checkPermission(req, EPermAction.read, EPermResource.apiKey, {
      orgId,
    })

    const { limit, offset } = parsePagination(req)

    const where: Record<string, string> = { orgId }
    if (projectId) where.projectId = projectId as string
    if (userId) where.userId = userId as string

    const { data, error } = await db.services.apiKey.list({ where, limit, offset })

    if (error) throw new Exception(500, error.message)

    const sanitizedData = (data || []).map((apiKey: ApiKey) => apiKey.sanitize())

    res.status(200).json({ data: sanitizedData, limit, offset })
  },
}
