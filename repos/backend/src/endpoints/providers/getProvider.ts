import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

/**
 * GET /providers/:id - Get provider by ID
 * Get provider first to find its scope (org/project)
 * Check membership in that scope
 */
export const getProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const data = await requireResourceWithPermission(
      req,
      db.services.provider,
      id,
      EPermAction.read,
      EPermResource.provider,
      `Provider`,
      (provider) => ({
        orgId: provider.orgId || undefined,
        projectId: provider.projectId || undefined,
      })
    )

    res.status(200).json({ data })
  },
}
