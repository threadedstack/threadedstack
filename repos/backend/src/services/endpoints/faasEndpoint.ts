import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { Endpoint, TFaaSEndpointConfig, TFunctionResponse } from '@tdsk/domain'

import { Exception, computeUnits } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { EEndpointType } from '@tdsk/domain'
import { PlanLimits, ESubscriptionTier } from '@tdsk/domain'
import { BaseEndpoint } from '@TBE/services/endpoints/base'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

/**
 * Resolved compute-quota context for one FaaS invocation, or `null` when
 * enforcement doesn't apply (no project/org resolvable, or the required
 * db services aren't wired) — in that case usage is neither checked nor
 * tracked, matching the endpoint's pre-existing behavior.
 */
type TComputeQuotaContext = {
  orgId: string
  period: string
  /** true once a 1-unit reservation was made pre-execution and needs truing up. */
  reserved: boolean
}

/**
 * FaaSEndpoint
 *
 * Handles FaaS-type endpoint execution by loading the linked function,
 * executing it inside a sandbox, and mapping the result to an HTTP response.
 */
export class FaaSEndpoint extends BaseEndpoint {
  readonly type = EEndpointType.faas

  validateOptions(options: Record<string, any>): void {
    if (!options?.functionId) {
      throw new Exception(400, `FaaS endpoint requires a functionId in options`)
    }
  }

  /**
   * Pre-execution compute-quota gate. The true cost of a call
   * (`computeUnits(1, runtimeMs)`) is only known AFTER it runs — runtime is
   * unknowable up front — so this reserves the minimum possible charge (1
   * unit, i.e. the per-call cost with ~0 runtime) before the function runs,
   * and the caller trues up the remainder via `trueUpComputeQuota` once
   * `runtimeMs` is known. A long-running call can therefore push usage
   * slightly over the limit before the NEXT request is rejected — an
   * accepted tradeoff (compute is a soft per-period budget here, not a hard
   * per-call ceiling) that still closes the prior gap where compute usage
   * was tracked but never enforced at all.
   *
   * Unlimited-tier orgs (`limit === -1`) skip the reservation (nothing to
   * enforce) but are still returned as a context so the caller tracks their
   * usage post-execution, same as every other tier.
   *
   * @throws {Exception} 403 when the org is already at/over its compute limit.
   * @throws {Exception} 503 when a required lookup fails (fails closed).
   */
  private async reserveComputeQuota(
    endpoint: Endpoint
  ): Promise<TComputeQuotaContext | null> {
    if (
      !endpoint.projectId ||
      !this.db.services.project ||
      !this.db.services.quota ||
      !this.db.services.org ||
      !this.db.services.subscription
    )
      return null

    const { data: project, error: projectErr } = await this.db.services.project.get(
      endpoint.projectId
    )
    if (projectErr) {
      logger.error(
        `[quota] Failed to look up project ${endpoint.projectId} for endpoint ${endpoint.id}:`,
        projectErr
      )
      throw new Exception(503, `quota_check_unavailable`)
    }
    if (!project?.orgId) return null

    const { data: org, error: orgErr } = await this.db.services.org.get(project.orgId)
    if (orgErr) {
      logger.error(`[quota] Failed to look up org ${project.orgId}:`, orgErr)
      throw new Exception(503, `quota_check_unavailable`)
    }
    if (!org?.ownerId) return null

    const { data: sub, error: subErr } = await this.db.services.subscription.findByUser(
      org.ownerId
    )
    if (subErr) {
      logger.error(`[quota] Subscription lookup failed for owner ${org.ownerId}:`, subErr)
      throw new Exception(503, `quota_check_unavailable`)
    }

    const tier = (sub?.tier || `free`) as ESubscriptionTier
    const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]
    const limit = limits.compute
    const period = getBillingPeriod()

    if (limit === -1) return { orgId: project.orgId, period, reserved: false }

    const result = await this.db.services.quota.incrementIfUnderLimit(
      project.orgId,
      period,
      `compute`,
      limit,
      1
    )
    if (result.error) {
      logger.error(
        `[quota] Atomic compute-quota check failed for org ${project.orgId}:`,
        result.error
      )
      throw new Exception(503, `quota_check_unavailable`)
    }
    if (result.quotaExceeded)
      throw new Exception(403, `Compute quota exceeded`, `quota_exceeded`)

    return { orgId: project.orgId, period, reserved: true }
  }

  /** True up the reserved unit to the actual post-execution cost (fire-and-forget, best-effort). */
  private trueUpComputeQuota(
    ctx: TComputeQuotaContext,
    endpoint: Endpoint,
    runtimeMs: number
  ): void {
    const units = computeUnits(1, runtimeMs)
    const amount = ctx.reserved ? units - 1 : units
    if (amount <= 0) return

    this.db.services.quota
      .increment(ctx.orgId, ctx.period, `compute`, amount)
      .catch((err: unknown) =>
        logger.error(
          `[quota] Failed to true up compute for endpoint=${endpoint.id}:`,
          err
        )
      )
  }

  async execute(req: TRequest, res: Response, endpoint: Endpoint): Promise<void> {
    const opts = endpoint.options as TFaaSEndpointConfig | undefined
    const functionId = opts?.functionId

    if (!functionId)
      throw new Exception(400, `FaaS endpoint has no functionId configured`)

    // Load the function record from the database
    const { data: func, error } = await this.db.services.function.get(functionId)

    if (error) throw new Exception(500, error.message)
    if (!func) throw new Exception(404, `Function not found: ${functionId}`)

    // Gate the invocation on the org's compute quota BEFORE running the
    // function (see reserveComputeQuota's doc comment for the reserve/true-up
    // tradeoff) — throws 403 if already at/over limit, 503 if a lookup fails.
    const quotaCtx = await this.reserveComputeQuota(endpoint)

    // Build TFunctionRequest from the Express request
    // Body is already parsed by the endpoint dispatcher via parseJsonBody
    const functionRequest = {
      method: req.method,
      path: req.path,
      headers: req.headers as Record<string, string>,
      query: (req.query || {}) as Record<string, string>,
      body: req.body || {},
    }

    // Build TFunctionContext from endpoint options
    const functionContext = {
      envVars: opts?.envVars,
      args: opts?.arguments,
    }

    // Execute the function in a sandbox with timing
    const startMs = Date.now()
    const result = await FunctionExecutor.execute(func as any, {
      db: this.db,
      request: functionRequest,
      context: functionContext,
    })
    const runtimeMs = Date.now() - startMs

    if (!result.success) {
      logger.error(`FaaS execution failed for function ${functionId}: ${result.error}`)
      // Roll back the pre-execution reservation — a failed run was never
      // billed before this change, and a failure here is the endpoint's own
      // error, not billable compute usage.
      if (quotaCtx?.reserved) {
        this.db.services.quota
          .decrement(quotaCtx.orgId, quotaCtx.period, `compute`, 1)
          .catch((err: unknown) =>
            logger.error(
              `[quota] Failed to roll back compute reservation for endpoint=${endpoint.id}:`,
              err
            )
          )
      }
      throw new Exception(
        500,
        `Function execution failed: ${result.error || 'Unknown error'}`
      )
    }

    // True up the pre-execution reservation to the actual cost now that
    // runtimeMs is known (fire-and-forget, best-effort — see trueUpComputeQuota).
    if (quotaCtx) this.trueUpComputeQuota(quotaCtx, endpoint, runtimeMs)

    // Map function output to HTTP response
    const output = (result.output || {}) as TFunctionResponse
    const statusCode = output.statusCode || 200
    const responseHeaders = output.headers
    const body = output.body ?? result.output

    // Apply custom response headers if present
    if (responseHeaders) {
      for (const [key, value] of Object.entries(responseHeaders)) {
        res.setHeader(key, value)
      }
    }

    res.status(statusCode).json(body)
  }
}
