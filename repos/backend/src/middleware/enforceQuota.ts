import type { NextFunction } from 'express'
import type { TRequest, TResponse, TQuotaResource } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { PlanLimits, ESubscriptionTier } from '@tdsk/domain'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'

/**
 * Map a POST route pattern to its corresponding quota resource key.
 * Returns undefined if the route does not map to a tracked resource.
 */
export const mapRouteToResource = (
  path: string,
  method: string
): TQuotaResource | `organizations` | undefined => {
  if (method.toUpperCase() !== `POST`) return undefined

  // Normalize: strip trailing slash, lowercase
  const normalized = path.replace(/\/+$/, ``).toLowerCase()

  if (normalized.endsWith(`/secrets`)) return `secrets`
  if (normalized.endsWith(`/threads`)) return `threads`
  if (normalized.endsWith(`/projects`)) return `projects`
  if (normalized.endsWith(`/orgs`)) return `organizations`
  if (normalized.endsWith(`/endpoints`)) return `endpoints`
  if (normalized.match(/\/threads\/[^/]+\/messages$/)) return `messages`

  return undefined
}

/**
 * Middleware that enforces quota limits before resource creation.
 * Checks the tier-based limit for the resource being created.
 * If the limit is -1, the resource is unlimited and always passes.
 * If at or over the limit, returns 403 quota_exceeded.
 *
 * For POST /orgs, uses a user-scoped count of owned orgs instead of the quota table.
 */
export const enforceQuota = async (req: TRequest, res: TResponse, next: NextFunction) => {
  try {
    const resource = mapRouteToResource(req.path, req.method)
    if (!resource) return next()

    const userId = req.user?.id
    if (!userId) return next()

    const { db } = req.app.locals
    const orgId = req.params?.orgId

    // For POST /orgs, check the user's total owned orgs against organizations limit
    if (resource === `organizations`) {
      const subResult = await db.services.subscription.findByUser(userId)
      if (subResult.error) {
        logger.error(
          `[enforceQuota] Subscription lookup failed for user ${userId}:`,
          subResult.error
        )
        return res.status(503).json({ error: `quota_check_unavailable` })
      }
      const tier = (subResult.data?.tier || `free`) as ESubscriptionTier
      const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]
      const limit = limits.organizations

      if (limit === -1) return next()

      const { data: ownedOrgs, error: listErr } = await db.services.org.list({
        where: { ownerId: userId },
      })
      if (listErr) {
        logger.error(
          `[enforceQuota] Failed to count owned orgs for user ${userId}:`,
          listErr
        )
        return res.status(503).json({ error: `quota_check_unavailable` })
      }
      const current = ownedOrgs?.length || 0

      if (current >= limit) {
        res.status(403).json({
          error: `quota_exceeded`,
          resource,
          current,
          limit,
        })
        return
      }

      return next()
    }

    // For all other resources, check org-scoped quotas
    if (!orgId) return next()

    // Look up org owner's tier
    const orgResult = await db.services.org.get(orgId)
    if (orgResult.error) {
      logger.error(`[enforceQuota] Failed to look up org ${orgId}:`, orgResult.error)
      return res.status(503).json({ error: `quota_check_unavailable` })
    }
    if (!orgResult.data) {
      logger.error(`[enforceQuota] Org ${orgId} not found`)
      return next()
    }
    if (!orgResult.data.ownerId) return next()

    const subResult = await db.services.subscription.findByUser(orgResult.data.ownerId)
    if (subResult.error) {
      logger.error(
        `[enforceQuota] Subscription lookup failed for owner ${orgResult.data.ownerId}:`,
        subResult.error.message
      )
      return res.status(503).json({ error: `quota_check_unavailable` })
    }
    const tier = (subResult.data?.tier || `free`) as ESubscriptionTier
    const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]
    const limit = (limits as Record<string, any>)[resource]

    // If limit is undefined, the resource is not tracked by the plan at all
    if (limit === undefined) return next()

    const period = getBillingPeriod()
    const quotaKey = resource as TQuotaResource

    const registerRollback = () => {
      res.on(`finish`, () => {
        if (res.statusCode >= 400 && req.quotaIncremented) {
          db.services.quota
            .decrement(orgId, period, quotaKey)
            .catch((err: unknown) =>
              logger.error(
                `[enforceQuota] Failed to rollback quota for ${resource} (org=${orgId}, period=${period}):`,
                err
              )
            )
        }
      })
    }

    // Usage tracking is decoupled from enforcement: unlimited (-1) plans skip
    // the limit check but still record usage, otherwise usage counters read 0
    // forever for any org whose owner is on an unlimited tier.
    if (limit === -1) {
      const result = await db.services.quota.increment(orgId, period, quotaKey)
      if (result.error) {
        // A tracking failure on an unlimited plan must not block the request:
        // there is no limit to enforce, the counter is informational only
        logger.error(
          `[enforceQuota] Failed to track ${quotaKey} usage for org ${orgId}:`,
          result.error
        )
        return next()
      }

      req.quotaIncremented = { orgId, period, resource: quotaKey }
      registerRollback()

      return next()
    }

    const result = await db.services.quota.incrementIfUnderLimit(
      orgId,
      period,
      quotaKey,
      limit
    )

    if (result.error) {
      logger.error(`[enforceQuota] Atomic quota check failed:`, result.error)
      return res.status(503).json({ error: `quota_check_unavailable` })
    }

    if (result.quotaExceeded) {
      const usageResult = await db.services.quota.findByOrgAndPeriod(orgId, period)
      const current = usageResult.data?.[resource] || 0

      res.status(403).json({
        error: `quota_exceeded`,
        resource,
        current,
        limit,
      })
      return
    }

    req.quotaIncremented = { orgId, period, resource: quotaKey }
    registerRollback()

    next()
  } catch (err) {
    // Quota enforcement fails closed: if it fails, block the request
    logger.error(`[enforceQuota] Error checking quota:`, err)
    res.status(503).json({ error: `quota_check_unavailable` })
  }
}
