import type { NextFunction } from 'express'
import type { TAHandler } from '@tdsk/domain'
import type { TRequest, TResponse, TQuotaResource } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { PlanLimits, ESubscriptionTier } from '@tdsk/domain'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'

/**
 * Middleware enforcing the org-creation limit for POST /orgs — a user-scoped
 * count of owned orgs, since there is no org yet at creation time to key an
 * org-scoped quota row off of. Mounted directly on createOrg's own route.
 */
export const enforceOrgCreationQuota = async (
  req: TRequest,
  res: TResponse,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id
    if (!userId) return next()

    const { db } = req.app.locals

    const subResult = await db.services.subscription.findByUser(userId)
    if (subResult.error) {
      logger.error(
        `[enforceOrgCreationQuota] Subscription lookup failed for user ${userId}:`,
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
        `[enforceOrgCreationQuota] Failed to count owned orgs for user ${userId}:`,
        listErr
      )
      return res.status(503).json({ error: `quota_check_unavailable` })
    }
    const current = ownedOrgs?.length || 0

    if (current >= limit) {
      res.status(403).json({
        error: `quota_exceeded`,
        resource: `organizations`,
        current,
        limit,
      })
      return
    }

    next()
  } catch (err) {
    // Quota enforcement fails closed: if it fails, block the request
    logger.error(`[enforceOrgCreationQuota] Error checking quota:`, err)
    res.status(503).json({ error: `quota_check_unavailable` })
  }
}

/**
 * Resource-aware quota-enforcement factory. Each router passes its own fixed
 * resource key explicitly instead of inferring it at runtime from req.path —
 * inside a nested Express router req.path is relative to that router's own
 * mount point (not the full request path), so suffix-matching against it
 * silently no-ops one level down from where it looks correct in isolation.
 * mergeParams (server/router.ts) still resolves req.params.orgId correctly
 * at any depth; only the path-suffix inference was the fragile part.
 *
 * Only fires on POST; every other method passes through untouched.
 */
export const enforceQuota = (resourceKey: TQuotaResource) => {
  const middleware = async (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      if (req.method.toUpperCase() !== `POST`) return next()

      const userId = req.user?.id
      if (!userId) return next()

      const { db } = req.app.locals
      const orgId = req.params?.orgId
      if (!orgId) return next()

      const orgResult = await db.services.org.get(orgId)
      if (orgResult.error) {
        logger.error(
          `[enforceQuota:${resourceKey}] Failed to look up org ${orgId}:`,
          orgResult.error
        )
        return res.status(503).json({ error: `quota_check_unavailable` })
      }
      if (!orgResult.data) {
        logger.error(`[enforceQuota:${resourceKey}] Org ${orgId} not found`)
        return next()
      }
      if (!orgResult.data.ownerId) return next()

      const subResult = await db.services.subscription.findByUser(orgResult.data.ownerId)
      if (subResult.error) {
        logger.error(
          `[enforceQuota:${resourceKey}] Subscription lookup failed for owner ${orgResult.data.ownerId}:`,
          subResult.error.message
        )
        return res.status(503).json({ error: `quota_check_unavailable` })
      }
      const tier = (subResult.data?.tier || `free`) as ESubscriptionTier
      const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]
      const limit = (limits as Record<string, any>)[resourceKey]

      // If limit is undefined, the resource is not tracked by the plan at all
      if (limit === undefined) return next()

      const period = getBillingPeriod()

      const registerRollback = () => {
        res.on(`finish`, () => {
          if (res.statusCode >= 400 && req.quotaIncremented) {
            db.services.quota
              .decrement(orgId, period, resourceKey)
              .catch((err: unknown) =>
                logger.error(
                  `[enforceQuota:${resourceKey}] Failed to rollback quota (org=${orgId}, period=${period}):`,
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
        const result = await db.services.quota.increment(orgId, period, resourceKey)
        if (result.error) {
          // A tracking failure on an unlimited plan must not block the request:
          // there is no limit to enforce, the counter is informational only
          logger.error(
            `[enforceQuota:${resourceKey}] Failed to track usage for org ${orgId}:`,
            result.error
          )
          return next()
        }

        req.quotaIncremented = { orgId, period, resource: resourceKey }
        registerRollback()

        return next()
      }

      const result = await db.services.quota.incrementIfUnderLimit(
        orgId,
        period,
        resourceKey,
        limit
      )

      if (result.error) {
        logger.error(
          `[enforceQuota:${resourceKey}] Atomic quota check failed:`,
          result.error
        )
        return res.status(503).json({ error: `quota_check_unavailable` })
      }

      if (result.quotaExceeded) {
        const usageResult = await db.services.quota.findByOrgAndPeriod(orgId, period)
        const current = usageResult.data?.[resourceKey] || 0

        res.status(403).json({
          error: `quota_exceeded`,
          resource: resourceKey,
          current,
          limit,
        })
        return
      }

      req.quotaIncremented = { orgId, period, resource: resourceKey }
      registerRollback()

      next()
    } catch (err) {
      // Quota enforcement fails closed: if it fails, block the request
      logger.error(`[enforceQuota:${resourceKey}] Error checking quota:`, err)
      res.status(503).json({ error: `quota_check_unavailable` })
    }
  }

  return middleware as TAHandler
}
