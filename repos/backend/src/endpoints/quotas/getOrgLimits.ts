import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import {
  Exception,
  PlanLimits,
  EPermAction,
  EPermResource,
  ESubscriptionTier,
} from '@tdsk/domain'

/**
 * GET /orgs/:orgId/quotas/limits - Get plan limits for an organization
 * Returns the limits from the org owner's subscription tier.
 */
export const getOrgLimits: TEndpointConfig = {
  path: `/limits`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.quota)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Get org to determine owner
    const orgResult = await db.services.org.get(orgId)

    if (orgResult.error || !orgResult.data?.ownerId)
      throw new Exception(500, orgResult.error?.message || `Organization not found`)

    const ownerId = orgResult.data.ownerId

    // Get owner's subscription to determine tier
    const subResult = await db.services.subscription.findByUser(ownerId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    // Use subscription tier or default to free
    const tier = (subResult.data?.tier || `free`) as ESubscriptionTier
    const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]

    res.status(200).json({ data: limits })
  },
}
