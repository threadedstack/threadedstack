import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'

/**
 * POST /quotas/:orgId/check - Check if action is within quota limits
 * Body: { resource: string, amount?: number }
 */
export const checkQuota: TEndpointConfig = {
  path: `/:orgId/check`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { resource, amount = 1 } = req.body
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!resource) throw new Exception(400, `Missing required field: resource`)
    if (typeof amount !== 'number' || amount <= 0)
      throw new Exception(400, `Amount must be a positive number`)

    // Check membership
    await requireOrgMember(req, orgId)

    // Get current period
    const period = getBillingPeriod()

    // Get current usage
    const usageResult = await db.services.quota.findByOrgAndPeriod(orgId, period)

    const currentUsage = usageResult.data?.[resource] || 0

    // Get org owner through roles table
    const ownerRole = await db.services.role.getOrgOwner(orgId)

    if (ownerRole.error || !ownerRole.data)
      throw new Exception(500, ownerRole.error?.message || `Org owner not found`)

    const ownerId = ownerRole.data.userId

    // Get owner's subscription to find limits
    const subResult = await db.services.subscription.findByUser(ownerId)

    let productId: string | undefined

    if (!subResult.data || !subResult.data.polarPriceId) {
      productId = payments.service.getProductIdForTier(`free`)
    } else {
      productId = subResult.data.polarPriceId
    }

    if (!productId) throw new Exception(500, `Product not configured`)

    // Fetch limits
    const limitsResult = await payments.service.getPlanLimits(productId)

    if (limitsResult.error || !limitsResult.data)
      throw new Exception(500, limitsResult.error?.message || `Failed to fetch limits`)

    const limit = limitsResult.data[resource]
    if (limit === undefined) throw new Exception(400, `Invalid resource: ${resource}`)

    const allowed = currentUsage + amount <= limit

    res.status(200).json({
      data: {
        allowed,
        current: currentUsage,
        limit,
        remaining: Math.max(0, limit - currentUsage),
      },
    })
  },
}
