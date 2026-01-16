import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { isSuperAdmin, ERoleType } from '@tdsk/domain'
import { getUserRole } from '@TBE/utils/auth/checkPermission'

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

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const userRole = await getUserRole(req, {})
    const isSuper = isSuperAdmin(userRole)

    // Get all user roles to map orgId -> role type
    const { data: userRoles, error: rolesError } =
      await db.services.role.getUserRoles(userId)

    if (rolesError) {
      res.status(500).json({ error: rolesError.message })
      return
    }

    // Create map of orgId -> role type
    const orgRoleMap = new Map<string, ERoleType>()
    userRoles?.forEach((role) => {
      if (role.orgId && role.type) {
        orgRoleMap.set(role.orgId, role.type as ERoleType)
      }
    })

    if (isSuper) {
      // Super admins can see all orgs
      const { data, error } = await db.services.org.list()

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      // Attach user role to each org (super for all orgs)
      const orgsWithRoles = data?.map((org) => ({
        ...org,
        // TODO: may want to switch this so it's always ERoleType.super
        // Otherwise super users won't be super for orgs they are invited to
        userRole: orgRoleMap.get(org.id) || ERoleType.super,
      }))

      res.status(200).json({ data: orgsWithRoles })
      return
    }

    const { data: orgIds, error: orgIdsError } =
      await db.services.role.getUserOrgs(userId)

    if (orgIdsError) {
      res.status(500).json({ error: orgIdsError.message })
      return
    }

    // Fetch only orgs the user is a member of using DB filtering
    const { data: userOrgs, error: listError } = await db.services.org.list({
      where: { id: orgIds },
    })

    if (listError) {
      res.status(500).json({ error: listError.message })
      return
    }

    // Attach user role to each org
    const orgsWithRoles =
      userOrgs?.map((org) => ({
        ...org,
        userRole: orgRoleMap.get(org.id) || ERoleType.viewer,
      })) || []

    res.status(200).json({ data: orgsWithRoles })
  },
}
