import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/ops-actions/:opsActionId - Fetch one ops action (org-scoped).
 */
export const getOpsAction: TEndpointConfig = {
  path: `/:opsActionId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.opsAction)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, opsActionId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!opsActionId) throw new Exception(400, `opsActionId is required`)

    const { data, error } = await db.services.opsAction.get(opsActionId)
    if (error) throw new Exception(500, error.message)
    if (!data || data.orgId !== orgId) throw new Exception(404, `Ops action not found`)

    res.json({ data })
  },
}
