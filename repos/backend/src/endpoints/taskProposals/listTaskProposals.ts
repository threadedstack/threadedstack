import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/task-proposals - List self-sensed task proposals for an org.
 * Optional ?status= and ?agentId= filters (equality).
 */
export const listTaskProposals: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.taskProposal)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    const where: Record<string, string> = { orgId }
    if (typeof req.query.status === `string`) where.status = req.query.status
    if (typeof req.query.agentId === `string`) where.agentId = req.query.agentId

    const { data, error } = await db.services.taskProposal.list({ where })
    if (error) throw new Exception(500, error.message)

    res.json({ data: data || [] })
  },
}
