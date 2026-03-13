import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { isSuperAdmin } from '@tdsk/domain'
import { Exception } from '@tdsk/domain'
import { getUserRole, requireOrgMember } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

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
    const { db, auth } = req.app.locals
    const orgId = req.query.orgId || auth.orgId

    // Check if user is super admin
    const userRole = await getUserRole(req, {})
    const isSuper = isSuperAdmin(userRole)

    const { limit, offset } = parsePagination(req)

    if (!isSuper && !orgId) throw new Exception(400, `orgId query parameter required`)

    // If orgId provided, verify user is member of that org
    if (orgId) await requireOrgMember(req, orgId)

    // List users with roles in the specified org
    if (orgId) {
      const { data: roleData, error: roleError } =
        await db.services.role.getOrgMembers(orgId)
      if (roleError) throw new Exception(500, roleError.message)

      // Get full user details in one query
      const userIds = roleData?.map((r) => r.userId) || []
      const { data: userList, error: userError } =
        await db.services.user.getByIds(userIds)
      if (userError) throw new Exception(500, (userError as Error).message)

      // Merge role data with user data
      const roleByUserId = new Map(roleData?.map((r) => [r.userId, r.type]))
      const users = (userList || []).map((user) => ({
        ...user,
        role: roleByUserId.get(user.id),
      }))

      res.status(200).json({ data: users, limit, offset })
      return
    }

    // Super admin: list all users
    const { data, error } = await db.services.user.list({ limit, offset })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data, limit, offset })
  },
}
