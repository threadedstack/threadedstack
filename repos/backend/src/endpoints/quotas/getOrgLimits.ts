import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'

/**
 * GET /quotas/:orgId/limits - Get plan limits for an organization
 * Returns the limits from the org owner's subscription
 */
export const getOrgLimits: TEndpointConfig = {
  path: `/:orgId/limits`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    // Check membership
    await requireOrgMember(req, orgId)

    // Get org owner through roles table
    const ownerRole = await db.services.role.getOrgOwner(orgId)

    if (ownerRole.error || !ownerRole.data) {
      res.status(500).json({
        error: ownerRole.error?.message || 'Org owner not found',
      })
      return
    }

    const ownerId = ownerRole.data.userId

    // Get owner's subscription
    const subResult = await db.services.subscription.findByUser(ownerId)
    if (subResult.error) {
      res.status(500).json({ error: subResult.error.message })
      return
    }

    // If no subscription, use free tier limits
    if (!subResult.data || !subResult.data.polarPriceId) {
      const freeProductId = payments.service.getProductIdForTier('free')

      if (!freeProductId) {
        res.status(500).json({ error: 'Free tier not configured' })
        return
      }

      const limitsResult = await payments.service.getPlanLimits(freeProductId)
      if (limitsResult.error || !limitsResult.data) {
        res.status(500).json({
          error: limitsResult.error?.message || 'Failed to fetch limits',
        })
        return
      }

      res.status(200).json({ data: limitsResult.data })
      return
    }

    // Fetch limits from Polar using product ID
    const productResult = await payments.service.fetchProduct(subResult.data.polarPriceId)

    if (productResult.error || !productResult.data) {
      res.status(500).json({
        error: productResult.error?.message || 'Failed to fetch product',
      })
      return
    }

    const limitsResult = await payments.service.getPlanLimits(productResult.data.id)

    if (limitsResult.error || !limitsResult.data) {
      res.status(500).json({
        error: limitsResult.error?.message || 'Failed to fetch limits',
      })
      return
    }

    res.status(200).json({ data: limitsResult.data })
  },
}
