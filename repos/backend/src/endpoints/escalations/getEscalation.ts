import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/escalations/:escalationId - Fetch one escalation (org-scoped).
 */
export const getEscalation: TEndpointConfig = {
  path: `/:escalationId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.escalation)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, escalationId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!escalationId) throw new Exception(400, `escalationId is required`)

    const { data, error } = await db.services.escalation.get(escalationId)
    if (error) throw new Exception(500, error.message)
    if (!data || data.orgId !== orgId) throw new Exception(404, `Escalation not found`)

    res.json({ data })
  },
}
