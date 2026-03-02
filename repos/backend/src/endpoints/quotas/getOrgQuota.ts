import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'

/**
 * GET /orgs/:orgId/quotas - Get current quota usage for an organization
 */
export const getOrgQuota: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Check membership
    await requireOrgMember(req, orgId)

    // Get current period (YYYY-MM format)
    const period = getBillingPeriod()

    const { data, error } = await db.services.quota.findByOrgAndPeriod(orgId, period)
    if (error) throw new Exception(500, error.message)

    data
      ? res.status(200).json({ data })
      : res.status(200).json({
          data: {
            orgId,
            period,
            price: 0,
            members: 0,
            threads: 0,
            runtime: 0,
            messages: 0,
            projects: 0,
            retention: 0,
            endpoints: 0,
            orgSecrets: 0,
            organizations: 0,
            functionCalls: 0,
            projectSecrets: 0,
          },
        })
  },
}
