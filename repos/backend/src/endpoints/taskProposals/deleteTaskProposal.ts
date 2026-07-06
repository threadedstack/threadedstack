import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:orgId/task-proposals/:proposalId - Delete a task proposal (org-scoped).
 * A missing or cross-org proposal 404s.
 */
export const deleteTaskProposal: TEndpointConfig = {
  path: `/:proposalId`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.taskProposal)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, proposalId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!proposalId) throw new Exception(400, `proposalId is required`)

    const { data: existing, error: getErr } =
      await db.services.taskProposal.get(proposalId)
    if (getErr) throw new Exception(500, getErr.message)
    if (!existing || existing.orgId !== orgId)
      throw new Exception(404, `Task proposal not found`)

    const { error } = await db.services.taskProposal.delete(proposalId)
    if (error) throw new Exception(500, error.message)

    res.json({ data: { id: proposalId } })
  },
}
