import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'

/**
 * GET /quotas/:orgId - Get current quota usage for an organization
 */
export const getOrgQuota: TEndpointConfig = {
  path: `/:orgId`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    // Check membership
    await requireOrgMember(req, orgId)

    // Get current period (YYYY-MM format)
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const { data, error } = await db.services.quota.findByOrgAndPeriod(orgId, period)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      // No quota record yet - return zeros
      res.status(200).json({
        data: {
          orgId,
          period,
          price: 0,
          retention: 0,
          organizations: 0,
          projects: 0,
          members: 0,
          endpoints: 0,
          threads: 0,
          messages: 0,
          functionCalls: 0,
          runtime: 0,
          orgSecrets: 0,
          projectSecrets: 0,
        },
      })
      return
    }

    res.status(200).json({ data })
  },
}
