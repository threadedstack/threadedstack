import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'

/**
 * GET /orgs/:orgId/quotas/limits - Get plan limits for an organization
 * Returns the limits from the org owner's subscription
 */
export const getOrgLimits: TEndpointConfig = {
  path: `/limits`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Check membership
    await requireOrgMember(req, orgId)

    // Get org owner through roles table
    const ownerRole = await db.services.role.getOrgOwner(orgId)

    if (ownerRole.error || !ownerRole.data)
      throw new Exception(500, ownerRole.error?.message || `Org owner not found`)

    const ownerId = ownerRole.data.userId

    // Get owner's subscription
    const subResult = await db.services.subscription.findByUser(ownerId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    // If no subscription, use free tier limits
    if (!subResult.data || !subResult.data.polarPriceId) {
      const freeProductId = payments.service.getProductIdForTier(`free`)

      if (!freeProductId) throw new Exception(500, `Free tier not configured`)

      const limitsResult = await payments.service.getPlanLimits(freeProductId)
      if (limitsResult.error || !limitsResult.data)
        throw new Exception(500, limitsResult.error?.message || `Failed to fetch limits`)

      res.status(200).json({ data: limitsResult.data })
      return
    }

    // Fetch limits from Polar using product ID
    const productResult = await payments.service.fetchProduct(subResult.data.polarPriceId)

    if (productResult.error || !productResult.data)
      throw new Exception(500, productResult.error?.message || `Failed to fetch product`)

    const limitsResult = await payments.service.getPlanLimits(productResult.data.id)

    if (limitsResult.error || !limitsResult.data)
      throw new Exception(500, limitsResult.error?.message || `Failed to fetch limits`)

    res.status(200).json({ data: limitsResult.data })
  },
}
