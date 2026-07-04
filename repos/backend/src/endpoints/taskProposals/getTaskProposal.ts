import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/task-proposals/:proposalId - Fetch one task proposal (org-scoped).
 */
export const getTaskProposal: TEndpointConfig = {
  path: `/:proposalId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.taskProposal)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, proposalId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!proposalId) throw new Exception(400, `proposalId is required`)

    const { data, error } = await db.services.taskProposal.get(proposalId)
    if (error) throw new Exception(500, error.message)
    if (!data || data.orgId !== orgId) throw new Exception(404, `Task proposal not found`)

    res.json({ data })
  },
}
