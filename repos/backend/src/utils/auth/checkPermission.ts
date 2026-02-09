import type { TRequest } from '@TBE/types'
import type { EPermAction, EPermResource } from '@tdsk/domain'

import { Exception } from '@TBE/utils/errors/exception'
import {
  ERoleType,
  canPerform,
  hasMinRole,
  isSuperAdmin,
  getHighestRole,
} from '@tdsk/domain'

export type TPermissionContext = {
  orgId?: string
  projectId?: string
  resourceId?: string
}

/**
 * Get user`s effective role for the given context
 * Checks org-level and project-level roles, returns highest
 */
export const getUserRole = async (
  req: TRequest,
  context: TPermissionContext
): Promise<ERoleType> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) return ERoleType.viewer

  const roles: ERoleType[] = []

  // Get org role if orgId provided
  if (context.orgId) {
    const { data: orgRole } = await db.services.role.getOrgRole(userId, context.orgId)
    if (orgRole?.type) {
      roles.push(orgRole.type as ERoleType)
    }
  }

  // Get project role if projectId provided
  if (context.projectId) {
    const { data: projectRole } = await db.services.role.getProjectRole(
      userId,
      context.projectId
    )
    if (projectRole?.type) roles.push(projectRole.type as ERoleType)
  }

  // Return highest role, or viewer if no roles found
  return roles.length > 0 ? getHighestRole(roles) : ERoleType.viewer
}

/**
 * Check if user can perform action on resource
 * Throws Exception if not allowed
 */
export const checkPermission = async (
  req: TRequest,
  action: EPermAction,
  resource: EPermResource,
  context: TPermissionContext = {}
): Promise<void> => {
  const userRole = await getUserRole(req, context)

  // Super admins can do anything
  if (isSuperAdmin(userRole)) return

  const result = canPerform(userRole, action, resource)

  if (!result.allowed)
    throw new Exception(
      403,
      result.reason || `Permission denied: cannot ${action} ${resource}`,
      `FORBIDDEN`
    )
}

/**
 * Check if user is member of org (has any role)
 * Throws 403 if not a member
 */
export const requireOrgMember = async (req: TRequest, orgId: string): Promise<void> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) throw new Exception(401, `Authentication required`, `UNAUTHORIZED`)

  const { data: isMember } = await db.services.role.isOrgMember(userId, orgId)

  if (!isMember)
    throw new Exception(403, `You are not a member of this organization`, `FORBIDDEN`)
}

/**
 * Check if user is member of project (has any role)
 * Throws 403 if not a member
 */
export const requireProjectMember = async (
  req: TRequest,
  projectId: string
): Promise<void> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) throw new Exception(401, `Authentication required`, `UNAUTHORIZED`)

  const { data: isMember } = await db.services.role.isProjectMember(userId, projectId)

  if (!isMember)
    throw new Exception(403, `You are not a member of this project`, `FORBIDDEN`)
}

/**
 * Require minimum role level
 * Throws 403 if user doesn`t have required role
 */
export const requireMinRole = async (
  req: TRequest,
  requiredRole: ERoleType,
  context: TPermissionContext = {}
): Promise<void> => {
  const userRole = await getUserRole(req, context)

  if (!hasMinRole(userRole, requiredRole))
    throw new Exception(
      403,
      `This action requires ${requiredRole} role or higher`,
      `FORBIDDEN`
    )
}
