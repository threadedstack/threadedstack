import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import type { Secret } from '@tdsk/domain'

/**
 * GET /secrets - List all secrets (metadata only)
 */
export const listSecrets: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, repoId } = req.query

    const { data, error } = await db.services.secret.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    // Filter by orgId or repoId if provided
    let secrets: Secret[] = data || []
    if (orgId) secrets = secrets.filter((s) => s.orgId === orgId)
    if (repoId) secrets = secrets.filter((s) => s.repoId === repoId)

    const sanitized = secrets.map((secret: Secret) => secret.sanitize())

    res.status(200).json({ data: sanitized })
  },
}
