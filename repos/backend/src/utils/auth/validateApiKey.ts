import type { ApiKey } from '@tdsk/domain'
import { AllowedScopes } from '@TBE/constants/values'

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
  const { name, orgId, repoId, scopes, expiresAt } = data

  if (!name) return { valid: false, error: `API key name is required` }

  const hasOrg = !!orgId
  const hasRepo = !!repoId

  if (!hasOrg && !hasRepo)
    return { valid: false, error: `API key must belong to an org or repo` }

  if (hasOrg && hasRepo)
    return {
      valid: false,
      error: `API key can only belong to one of: org or repo (exclusive arc)`,
    }

  if (scopes) {
    const result = validateApiScopes(scopes)
    if (!result.valid || result.error) return result
  }

  if (expiresAt) {
    const result = validateExpiresAt(expiresAt)
    if (!result.valid || result.error) return result
  }

  return { valid: true }
}
