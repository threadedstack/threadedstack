import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/skill-proposals/:proposalId - Fetch one skill proposal (org-scoped).
 */
export const getSkillProposal: TEndpointConfig = {
  path: `/:proposalId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.skillProposal)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, proposalId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!proposalId) throw new Exception(400, `proposalId is required`)

    const { data, error } = await db.services.skillProposal.get(proposalId)
    if (error) throw new Exception(500, error.message)
    if (!data || data.orgId !== orgId)
      throw new Exception(404, `Skill proposal not found`)

    res.json({ data })
  },
}
