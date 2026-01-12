import type { ApiKey } from '@tdsk/domain'
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /api-keys - List all API keys (masked)
 */
export const listApiKeys: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId } = req.query

    const { data, error } = await db.services.apiKey.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    let keys = data || []
    if (orgId) keys = keys.filter((k: any) => k.orgId === orgId)
    if (projectId) keys = keys.filter((k: any) => k.projectId === projectId)

    const sanitizedData = keys.map((apiKey: ApiKey) => apiKey.sanitize())

    res.status(200).json({ data: sanitizedData })
  },
}
