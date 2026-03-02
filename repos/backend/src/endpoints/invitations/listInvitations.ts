import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { parsePagination } from '@TBE/utils/pagination'
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
    const { status = `pending` } = req.query

    // Check permission - requires admin+ in the org
    await checkPermission(req, EPermAction.read, EPermResource.role, { orgId })

    const { limit, offset } = parsePagination(req)

    let invitations
    // TODO: make status an enum
    if (status === `pending`) {
      const { data, error } = await db.services.invitation.getPendingByOrg(orgId)
      if (error) throw new Exception(500, error.message)
      invitations = data
    } else {
      const { data, error } = await db.services.invitation.getAllByOrg(orgId)
      if (error) throw new Exception(500, error.message)

      invitations = status === `all` ? data : data?.filter((inv) => inv.status === status)
    }

    res.status(200).json({
      limit,
      offset,
      success: true,
      data: invitations,
    })
  },
}
