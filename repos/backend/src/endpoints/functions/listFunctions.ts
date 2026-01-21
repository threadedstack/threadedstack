import type { Response } from 'express'
import type { Function as TDFunction } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

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
    if (!projectId) {
      res.status(400).json({ error: 'projectId query parameter required' })
      return
    }

    // Check permission
    await checkPermission(req, EPermAction.read, EPermResource.function, {
      projectId: projectId as string,
    })

    const { data, error } = await db.services.function.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    // Filter by projectId
    const functions: TDFunction[] = (data || []).filter((f) => f.projectId === projectId)

    res.status(200).json({ data: functions })
  },
}
