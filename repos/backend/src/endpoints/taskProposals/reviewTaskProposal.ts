import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { rejectTaskProposal } from '@TBE/utils/agent/taskPromotion'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/task-proposals/:proposalId/review - Reject (or no-op approve) a proposal.
 * There is NO approve action here: task proposals are promoted automatically by
 * the work cycle once it opens a CI-gated PR (see markTaskPromoted). The admin
 * surface can only reject — an async override that filters a proposal out of
 * the backlog and never blocks the steward. `{ approve: true }` is a
 * deliberate no-op that returns the proposal unchanged.
 */
export const reviewTaskProposal: TEndpointConfig = {
  path: `/:proposalId/review`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.update, EPermResource.taskProposal)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, proposalId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!proposalId) throw new Exception(400, `proposalId is required`)

    const { approve, reason } = req.body
    if (typeof approve !== `boolean`)
      throw new Exception(400, `approve must be a boolean`)
    if (reason !== undefined && typeof reason !== `string`)
      throw new Exception(400, `reason must be a string`)

    const { data: proposal, error } = await db.services.taskProposal.get(proposalId)
    if (error) throw new Exception(500, error.message)
    if (!proposal || proposal.orgId !== orgId)
      throw new Exception(404, `Task proposal not found`)

    if (approve === true) {
      res.json({
        data: proposal,
        note: `Task promotion is automatic (work-cycle driven); the admin surface can only reject.`,
      })
      return
    }

    await rejectTaskProposal(db, proposal, reason ?? `Rejected via admin`, req.user?.id)

    const { data } = await db.services.taskProposal.get(proposalId)
    res.json({ data })
  },
}
