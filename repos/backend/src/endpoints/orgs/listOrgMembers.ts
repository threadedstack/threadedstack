import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { requireOrgMember } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

/**
 * GET /orgs/:id/members - List all members of an org
 * Requires viewer+ role (any member can see member list)
 */
export const listOrgMembers: TEndpointConfig = {
  path: `/:id/members`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId } = req.params
    const { db } = req.app.locals

    // Check membership first (viewer+ can see members)
    await requireOrgMember(req, orgId)

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.role.getOrgMembers(orgId)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data, limit, offset })
  },
}
