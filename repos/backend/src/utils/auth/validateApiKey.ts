import type { ApiKey } from '@tdsk/domain'
import { AllowedScopes } from '@TBE/constants/values'
import { ERoleType, hasMinRole, EApiKeyScope } from '@tdsk/domain'

const ScopeHierarchy: Record<EApiKeyScope, number> = {
  [EApiKeyScope.read]: 1,
  [EApiKeyScope.write]: 2,
  [EApiKeyScope.admin]: 3,
}

const RoleToMaxScope: Record<ERoleType, number> = {
  [ERoleType.viewer]: 1,
  [ERoleType.member]: 2,
  [ERoleType.admin]: 3,
  [ERoleType.owner]: 3,
  [ERoleType.super]: 3,
}

/**
 * Validates project-scoped API key creation permissions.
 * Enforces:
 * - Org admins (admin/owner/super roles) bypass all project-level restrictions
 * - Non-admin project members (viewer/member) can only create keys for themselves
 * - Scope ceiling: requested scopes cannot exceed the caller's role-derived max scope
 */
export const validateProjectKeyPermission = (params: {
  requesterRole: ERoleType
  requesterUserId: string
  targetUserId?: string
  requestedScopes: string
  isOrgAdmin: boolean
}): { valid: boolean; error?: string } => {
  const { requesterRole, requesterUserId, targetUserId, requestedScopes, isOrgAdmin } =
    params

  if (isOrgAdmin) return { valid: true }

  if (targetUserId && targetUserId !== requesterUserId) {
    if (!hasMinRole(requesterRole, ERoleType.admin))
      return {
        valid: false,
        error: `Only project admins can create API keys for other users`,
      }
  }

  const maxAllowed = RoleToMaxScope[requesterRole] ?? 1
  const requestedMax = Math.max(
    ...requestedScopes
      .split(`,`)
      .map((s) => ScopeHierarchy[s.trim() as EApiKeyScope] ?? 0)
  )

  if (requestedMax > maxAllowed)
    return {
      valid: false,
      error: `Your project role (${requesterRole}) cannot create keys with scope exceeding your permissions`,
    }

  return { valid: true }
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
