import type { ApiKey } from '@tdsk/domain'
import type { TPermission } from '@tdsk/domain'
import { ERoleType, hasMinRole } from '@tdsk/domain'

type TValidateProjKeyPerm = {
  isOrgAdmin: boolean
  targetUserId?: string
  requesterRole: ERoleType | null
  requesterUserId: string
  requestedPermissions: TPermission[]
  targetUserPermissions: Set<TPermission>
}

/**
 * Validates that requested API key permissions are a subset of the
 * target user's effective permissions. No permission on the key can
 * exceed what the user it belongs to actually has.
 */
export const validateApiKeyPermissions = (
  requestedPermissions: TPermission[],
  targetUserPermissions: Set<TPermission>
): { valid: boolean; error?: string; invalidPermissions?: TPermission[] } => {
  const invalid = requestedPermissions.filter((p) => !targetUserPermissions.has(p))
  if (invalid.length > 0) {
    return {
      valid: false,
      error: `Target user does not have these permissions: ${invalid.join(', ')}`,
      invalidPermissions: invalid,
    }
  }
  return { valid: true }
}

/**
 * Validates project-scoped API key creation permissions.
 * Enforces:
 * - Org admins (admin/owner/super roles) bypass target-user restrictions
 * - Non-admin project members can only create keys for themselves
 * - Requested permissions must be a subset of the target user's permissions
 */
export const validateProjectKeyPermission = (
  params: TValidateProjKeyPerm
): { valid: boolean; error?: string } => {
  const {
    isOrgAdmin,
    targetUserId,
    requesterRole,
    requesterUserId,
    requestedPermissions,
    targetUserPermissions,
  } = params

  if (targetUserId && targetUserId !== requesterUserId)
    if (!isOrgAdmin && !hasMinRole(requesterRole, ERoleType.admin))
      return {
        valid: false,
        error: `Only project admins can create API keys for other users`,
      }

  return validateApiKeyPermissions(requestedPermissions, targetUserPermissions)
}

export const validateExpiresAt = (expiresAt: string | Date) => {
  const expiry = new Date(expiresAt)
  if (isNaN(expiry.getTime())) return { valid: false, error: `Invalid expiration date` }

  if (expiry <= new Date())
    return { valid: false, error: `Expiration date must be in the future` }

  return { valid: true }
}

export const validateApiKey = (data: Partial<ApiKey>) => {
  const { name, orgId, projectId, expiresAt } = data

  if (!name) return { valid: false, error: `API key name is required` }

  const hasOrg = !!orgId
  const hasProject = !!projectId

  if (!hasOrg && !hasProject)
    return { valid: false, error: `API key must belong to an org or project` }

  if (hasOrg && hasProject)
    return {
      valid: false,
      error: `API key can only belong to one of: org or project (exclusive arc)`,
    }

  if (expiresAt) {
    const result = validateExpiresAt(expiresAt)
    if (!result.valid) return result
  }

  return { valid: true }
}
