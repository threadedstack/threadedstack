import type { Response } from 'express'
import type { Function as TDFunction } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /_/functions - List all functions
 * Requires member+ role in the project
 */
export const listFunctions: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.query

    // projectId is required
    if (!projectId) throw new Exception(400, `projectId query parameter required`)

    // Check permission
    await checkPermission(req, EPermAction.read, EPermResource.function, {
      projectId: projectId as string,
    })

    const { data, error } = await db.services.function.list()
    if (error) throw new Exception(500, error.message)

    // Filter by projectId
    const functions: TDFunction[] = (data || []).filter((f) => f.projectId === projectId)

    res.status(200).json({ data: functions })
  },
}
