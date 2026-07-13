import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import type { EInviteStatus } from '@tdsk/domain'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

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
  middleware: [authorize(EPermAction.read, EPermResource.invitation)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params
    const { status = `pending` } = req.query

    const { limit, offset } = parsePagination(req)

    const isPending = status === `pending`
    const isAll = status === `all`

    const { data, error } = isPending
      ? await db.services.invitation.getPendingByOrg(orgId, { limit, offset })
      : await db.services.invitation.getAllByOrg(orgId, {
          limit,
          offset,
          ...(isAll ? {} : { status: status as EInviteStatus }),
        })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({
      limit,
      offset,
      success: true,
      data,
    })
  },
}
