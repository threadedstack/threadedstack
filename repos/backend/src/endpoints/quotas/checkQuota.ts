import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import {
  Exception,
  PlanLimits,
  ESubscriptionTier,
  EPermAction,
  EPermResource,
} from '@tdsk/domain'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'

/**
 * POST /orgs/:orgId/quotas/check - Check if action is within quota limits
 * Body: { resource: string, amount?: number }
 */
export const checkQuota: TEndpointConfig = {
  path: `/check`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.read, EPermResource.quota)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { resource, amount = 1 } = req.body
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!resource) throw new Exception(400, `Missing required field: resource`)
    if (typeof amount !== 'number' || amount <= 0)
      throw new Exception(400, `Amount must be a positive number`)

    // Get current period
    const period = getBillingPeriod()

    // Get current usage
    const usageResult = await db.services.quota.findByOrgAndPeriod(orgId, period)
    if (usageResult.error) throw new Exception(500, usageResult.error.message)

    const currentUsage = usageResult.data?.[resource] || 0

    // Get org to determine owner
    const orgResult = await db.services.org.get(orgId)

    if (orgResult.error) throw new Exception(500, orgResult.error.message)
    if (!orgResult.data) throw new Exception(404, `Organization not found`)

    const ownerId = orgResult.data.ownerId
    if (!ownerId) {
      res.status(200).json({
        data: { allowed: true, current: currentUsage, limit: -1, remaining: -1 },
      })
      return
    }

    // Get owner's subscription to find limits
    const subResult = await db.services.subscription.findByUser(ownerId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    // Use subscription tier or default to free
    const tier = (subResult.data?.tier || `free`) as ESubscriptionTier
    const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]
    const limit = (limits as Record<string, any>)[resource]

    if (limit === undefined) throw new Exception(400, `Invalid resource: ${resource}`)

    // -1 means unlimited
    const allowed = limit === -1 || currentUsage + amount <= limit

    res.status(200).json({
      data: {
        allowed,
        current: currentUsage,
        limit,
        remaining: limit === -1 ? -1 : Math.max(0, limit - currentUsage),
      },
    })
  },
}
