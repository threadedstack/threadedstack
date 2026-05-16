import type { ApiKey } from '@tdsk/domain'
import { AllowedScopes } from '@TBE/constants/values'
import { ERoleType, hasMinRole, RoleHierarchy, ApiKeyAllowedRoles } from '@tdsk/domain'

type TValidateProjKeyPerm = {
  isOrgAdmin: boolean
  targetUserId?: string
  requestedRole: string
  requesterRole: ERoleType | null
  requesterUserId: string
}

/**
 * Validates that the requested API key role does not exceed the caller's effective role.
 * Owner/super callers are capped at creating admin-role keys (no owner/super keys).
 */
export const validateApiKeyRole = (
  role: string,
  callerRole: ERoleType | null
): { valid: boolean; error?: string } => {
  if (!ApiKeyAllowedRoles.includes(role as ERoleType)) {
    return {
      valid: false,
      error: `Invalid API key role "${role}". Valid values are: ${ApiKeyAllowedRoles.join(`, `)}`,
    }
  }

  if (!callerRole)
    return { valid: false, error: `Cannot determine caller role for key creation` }

  const callerLevel = RoleHierarchy.indexOf(callerRole)
  const adminLevel = RoleHierarchy.indexOf(ERoleType.admin)
  const effectiveCallerCeiling = Math.min(callerLevel, adminLevel)
  const requestedLevel = RoleHierarchy.indexOf(role as ERoleType)

  if (requestedLevel > effectiveCallerCeiling)
    return {
      valid: false,
      error: `Your role (${callerRole}) cannot create API keys with role "${role}"`,
    }

  return { valid: true }
}

/**
 * Validates project-scoped API key creation permissions.
 * Enforces:
 * - Org admins (admin/owner/super roles) bypass target-user restrictions
 * - Non-admin project members can only create keys for themselves
 * - Role ceiling: requested role cannot exceed the caller's project role
 */
export const validateProjectKeyPermission = (
  params: TValidateProjKeyPerm
): { valid: boolean; error?: string } => {
  const { isOrgAdmin, targetUserId, requestedRole, requesterRole, requesterUserId } =
    params

  if (targetUserId && targetUserId !== requesterUserId)
    if (!isOrgAdmin && !hasMinRole(requesterRole, ERoleType.admin))
      return {
        valid: false,
        error: `Only project admins can create API keys for other users`,
      }

  return validateApiKeyRole(requestedRole, requesterRole)
}

export const validateApiScopes = (scopes: string) => {
  const list = scopes.split(',').map((s) => s.trim())
  const valid = list.every((scope) => AllowedScopes.includes(scope))
  return valid
    ? { valid }
    : { valid, error: `Invalid scopes. Valid values are: ${AllowedScopes.join(', ')}` }
}

export const validateExpiresAt = (expiresAt: string | Date) => {
  const expiry = new Date(expiresAt)
  if (isNaN(expiry.getTime())) return { valid: false, error: `Invalid expiration date` }

  if (expiry <= new Date())
    return { valid: false, error: `Expiration date must be in the future` }

  return { valid: true }
}

export const validateApiKey = (data: Partial<ApiKey>) => {
  const { name, orgId, projectId, scopes, expiresAt } = data

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

  if (scopes) {
    const result = validateApiScopes(scopes)
    if (!result.valid) return result
  }

  if (expiresAt) {
    const result = validateExpiresAt(expiresAt)
    if (!result.valid) return result
  }

  return { valid: true }
}
