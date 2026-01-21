import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /_/invitations/org/:orgId - List all invitations for an org
 * Requires admin+ role in the org
 *
 * Query params:
 * - status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'all' (default: 'pending')
 */
export const listInvitations: TEndpointConfig = {
  path: `/org/:orgId`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params
    const { status = 'pending' } = req.query

    // Check permission - requires admin+ in the org
    await checkPermission(req, EPermAction.read, EPermResource.role, { orgId })

    let invitations
    if (status === 'pending') {
      const { data, error } = await db.services.invitation.getPendingByOrg(orgId)
      if (error) {
        res.status(500).json({ error: error.message })
        return
      }
      invitations = data
    } else {
      const { data, error } = await db.services.invitation.getAllByOrg(orgId)
      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      invitations = status === `all` ? data : data?.filter((inv) => inv.status === status)
    }

    res.status(200).json({
      success: true,
      data: invitations,
    })
  },
}
