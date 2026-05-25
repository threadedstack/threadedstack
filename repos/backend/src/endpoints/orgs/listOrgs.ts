import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { parsePagination } from '@TBE/utils/pagination'
import { ERoleType, Exception, isSuperAdmin } from '@tdsk/domain'

/**
 * GET /orgs - List all orgs
 * Only returns orgs where user is a member (super admins see all)
 * Each org includes the user's role for that org
 */
export const listOrgs: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: userRoles, error: rolesError } =
      await db.services.role.getUserRoles(userId)

    if (rolesError) throw new Exception(500, rolesError.message)

    // Create map of orgId -> role type
    const orgRoleMap = new Map<string, ERoleType>()
    userRoles?.forEach((role) => {
      if (role.orgId && role.type) {
        orgRoleMap.set(role.orgId, role.type as ERoleType)
      }
    })

    const isSuper = userRoles?.some((r) => isSuperAdmin(r.type as ERoleType)) ?? false

    const { limit, offset } = parsePagination(req)

    if (isSuper) {
      // Super admins can see all orgs
      const { data, error } = await db.services.org.list({ limit, offset })

      if (error) throw new Exception(500, error.message)

      // Attach user role to each org (super for all orgs)
      const orgsWithRoles = data?.map((org) => ({
        ...org,
        // Note: Super admins get their mapped org role if one exists,
        // otherwise fall back to ERoleType.super. This preserves
        // per-org role assignments for super admins who are also org members.
        userRole: orgRoleMap.get(org.id) || ERoleType.super,
      }))

      res.status(200).json({ data: orgsWithRoles, limit, offset })
      return
    }

    const { data: orgIds, error: orgIdsError } =
      await db.services.role.getUserOrgs(userId)

    if (orgIdsError) throw new Exception(500, orgIdsError.message)

    // User has no org memberships — return empty list immediately
    if (!orgIds?.length) {
      res.status(200).json({ data: [], limit, offset })
      return
    }

    // Fetch only orgs the user is a member of using DB filtering
    const { data: userOrgs, error: listError } = await db.services.org.list({
      limit,
      offset,
      where: { id: orgIds },
    })

    if (listError) throw new Exception(500, listError.message)

    // Attach user role to each org
    const orgsWithRoles =
      userOrgs?.map((org) => ({
        ...org,
        userRole: orgRoleMap.get(org.id) || null,
      })) || []

    res.status(200).json({ data: orgsWithRoles, limit, offset })
  },
}
