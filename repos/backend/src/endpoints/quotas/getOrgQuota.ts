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
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

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
            projects: 0,
            compute: 0,
            threads: 0,
            messages: 0,
            endpoints: 0,
            secrets: 0,
          },
        })
  },
}
