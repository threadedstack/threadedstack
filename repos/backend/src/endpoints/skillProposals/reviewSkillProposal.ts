import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { applySkillReview } from '@TBE/utils/agent/skillPromotion'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/skill-proposals/:proposalId/review - Approve or reject a proposal.
 * On approve the deterministic scan is RE-RUN (hard gate) before promotion.
 * This is the human veto surface and the api-brain auditor's action; the same
 * logic runs server-side from the runtime-brain review-block capture.
 */
export const reviewSkillProposal: TEndpointConfig = {
  path: `/:proposalId/review`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.update, EPermResource.skillProposal)],
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

    const status = await applySkillReview(
      db,
      orgId,
      { proposalId, approve, reason },
      req.user?.id
    )
    if (status === null)
      throw new Exception(404, `Skill proposal not found or not actionable`)

    const { data } = await db.services.skillProposal.get(proposalId)
    res.json({ data })
  },
}
