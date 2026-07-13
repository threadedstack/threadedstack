import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /orgs/:orgId/quotas - Get current quota usage for an organization
 */
export const getOrgQuota: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.quota)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db, sandbox } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Get current period (YYYY-MM format)
    const period = getBillingPeriod()

    const { data, error } = await db.services.quota.findByOrgAndPeriod(orgId, period)
    if (error) throw new Exception(500, error.message)

    // sandboxSessions is a live concurrent count (not period-accumulated like the
    // other resources), sourced directly from SandboxService rather than the
    // quotas table, then merged into the same current/limit shape the admin UI
    // already pairs with getOrgLimits' static PlanLimits.sandboxSessions.
    // req.app.locals.sandbox is only set when K8s init succeeds (see
    // SandboxService.initKube) -- fall back to 0 when sandbox features are
    // unavailable rather than throwing on the undefined sandbox instance.
    const sandboxSessions = req.app.locals.sandboxAvailable
      ? sandbox.getOrgShellSessionCount(orgId)
      : 0

    data
      ? res.status(200).json({ data: { ...data, sandboxSessions } })
      : res.status(200).json({
          data: {
            orgId,
            period,
            projects: 0,
            compute: 0,
            threads: 0,
            messages: 0,
            endpoints: 0,
            secrets: 0,
            sandboxSessions,
          },
        })
  },
}
