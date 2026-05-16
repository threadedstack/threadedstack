import type { TRequest } from '@TBE/types'
import type { ERoleType } from '@tdsk/domain'
import { Exception, isSuperAdmin } from '@tdsk/domain'

/**
 * Check if a user is a platform super admin by querying the roles table.
 * Unlike checking req.user.role (which is the neon_auth user.role column
 * and is always null), this queries the actual roles table for any
 * role with type 'super'.
 */
export const isPlatformSuperAdmin = async (req: TRequest): Promise<boolean> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) return false

  const { data: userRoles, error } = await db.services.role.getUserRoles(userId)
  if (error) throw new Exception(500, `Role lookup failed: ${error.message}`)

  return userRoles?.some((role) => isSuperAdmin(role.type as ERoleType)) ?? false
}
