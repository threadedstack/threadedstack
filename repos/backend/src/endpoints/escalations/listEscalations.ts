import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource, EEscalationStatus } from '@tdsk/domain'

const ValidStatuses = new Set(Object.values(EEscalationStatus))

/**
 * GET /:orgId/escalations - List agent escalations for an org.
 * Optional ?status= (must be open|routed|resolved|rejected) and ?agentId= filters.
 */
export const listEscalations: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.escalation)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    if (
      typeof req.query.status === `string` &&
      !ValidStatuses.has(req.query.status as any)
    )
      throw new Exception(400, `status must be one of: ${[...ValidStatuses].join(`, `)}`)

    const where: Record<string, string> = { orgId }
    if (typeof req.query.status === `string`) where.status = req.query.status
    if (typeof req.query.agentId === `string`) where.agentId = req.query.agentId

    const { data, error } = await db.services.escalation.list({ where })
    if (error) throw new Exception(500, error.message)

    res.json({ data: data || [] })
  },
}
