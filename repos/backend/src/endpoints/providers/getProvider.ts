import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

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

    const { data, error } = await db.services.provider.get(id)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Provider not found`)

    // Check permission based on provider's scope (Exclusive Arc pattern)
    const context = {
      orgId: data.orgId || undefined,
      projectId: data.projectId || undefined,
    }

    await checkPermission(req, EPermAction.read, EPermResource.provider, context)

    res.status(200).json({ data })
  },
}
