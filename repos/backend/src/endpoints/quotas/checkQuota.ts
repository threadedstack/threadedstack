import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'

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

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    if (!resource) {
      res.status(400).json({ error: `Missing required field: resource` })
      return
    }

    // Check membership
    await requireOrgMember(req, orgId)

    // Get current period
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Get current usage
    const usageResult = await db.services.quota.findByOrgAndPeriod(orgId, period)

    const currentUsage = usageResult.data?.[resource] || 0

    // Get org owner through roles table
    const ownerRole = await db.services.role.getOrgOwner(orgId)

    if (ownerRole.error || !ownerRole.data) {
      res.status(500).json({
        error: ownerRole.error?.message || 'Org owner not found',
      })
      return
    }

    const ownerId = ownerRole.data.userId

    // Get owner's subscription to find limits
    const subResult = await db.services.subscription.findByUser(ownerId)

    let productId: string | undefined

    if (!subResult.data || !subResult.data.polarPriceId) {
      productId = payments.service.getProductIdForTier(`free`)
    } else {
      productId = subResult.data.polarPriceId
    }

    if (!productId) {
      res.status(500).json({ error: `Product not configured` })
      return
    }

    // Fetch limits
    const limitsResult = await payments.service.getPlanLimits(productId)

    if (limitsResult.error || !limitsResult.data) {
      res.status(500).json({
        error: limitsResult.error?.message || 'Failed to fetch limits',
      })
      return
    }

    const limit = limitsResult.data[resource]

    if (limit === undefined) {
      res.status(400).json({ error: `Invalid resource: ${resource}` })
      return
    }

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
