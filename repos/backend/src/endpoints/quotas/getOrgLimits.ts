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

    // Get org to determine owner
    const orgResult = await db.services.org.get(orgId)

    if (orgResult.error || !orgResult.data?.ownerId)
      throw new Exception(500, orgResult.error?.message || `Organization not found`)

    const ownerId = orgResult.data.ownerId

    // Get owner's subscription to determine tier
    const subResult = await db.services.subscription.findByUser(ownerId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    // Use subscription tier or default to free
    const tier = subResult.data?.tier || `free`
    const productId = payments.service.getProductIdForTier(tier)

    if (!productId) throw new Exception(500, `Product not configured for tier: ${tier}`)

    const limitsResult = await payments.service.getPlanLimits(productId)

    if (limitsResult.error || !limitsResult.data)
      throw new Exception(500, limitsResult.error?.message || `Failed to fetch limits`)

    res.status(200).json({ data: limitsResult.data })
  },
}
