import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /providers - List all providers
 * Filter by orgId or projectId query param
 * User must be member of the org/project
 */
export const listProviders: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgId = req.query.orgId as string | undefined
    const projectId = req.query.projectId as string | undefined

    if (!orgId && !projectId) {
      res.status(400).json({ error: 'orgId or projectId query parameter required' })
      return
    }

    // Check permission to read providers in this scope
    await checkPermission(req, EPermAction.read, EPermResource.provider, {
      orgId,
      projectId,
    })

    // List providers for the specified scope
    const { data, error } = await db.services.provider.list({ orgId, projectId })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data: data || [] })
  },
}
