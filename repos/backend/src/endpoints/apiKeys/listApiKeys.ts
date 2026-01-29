import type { Response } from 'express'
import type { ApiKey } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
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
    const { orgId, projectId } = req.query

    // Require orgId for API keys (they belong to orgs)
    if (!orgId) {
      throw new Exception(400, 'orgId query parameter required')
    }

    // Check permission - requires admin+
    await checkPermission(req, EPermAction.read, EPermResource.apiKey, {
      orgId: orgId as string,
    })

    const { data, error } = await db.services.apiKey.list()

    if (error) {
      throw new Exception(500, error.message)
    }

    let keys = data || []
    if (orgId) keys = keys.filter((k: any) => k.orgId === orgId)
    if (projectId) keys = keys.filter((k: any) => k.projectId === projectId)

    const sanitizedData = keys.map((apiKey: ApiKey) => apiKey.sanitize())

    res.status(200).json({ data: sanitizedData })
  },
}
