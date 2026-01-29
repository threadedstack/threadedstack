import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { isSuperAdmin } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { getUserRole, requireOrgMember } from '@TBE/utils/auth/checkPermission'

/**
 * GET /users - List all users
 * Requires orgId query param to list users in an org
 * User must be member of the org to see its members
 * Super admins can list all users (no orgId required)
 */
export const listUsers: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgId = req.query.orgId as string | undefined

    // Check if user is super admin
    const userRole = await getUserRole(req, {})
    const isSuper = isSuperAdmin(userRole)

    if (!isSuper && !orgId) throw new Exception(400, `orgId query parameter required`)

    // If orgId provided, verify user is member of that org
    if (orgId) await requireOrgMember(req, orgId)

    // List users with roles in the specified org
    if (orgId) {
      const { data: roleData, error: roleError } =
        await db.services.role.getOrgMembers(orgId)
      if (roleError) throw new Exception(500, roleError.message)

      // Get full user details for each member
      const userIds = roleData?.map((r) => r.userId) || []
      const users = []
      for (const userId of userIds) {
        const { data: user } = await db.services.user.get(userId)
        if (user) {
          const role = roleData?.find((r) => r.userId === userId)
          users.push({ ...user, role: role?.type })
        }
      }

      res.status(200).json({ data: users })
      return
    }

    // Super admin: list all users
    const { data, error } = await db.services.user.list()
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
