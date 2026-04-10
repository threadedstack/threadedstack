import type { ApiClient } from '@TSA/services/api'

/**
 * Resolves the organization ID from an explicit parameter or auto-detect.
 * Throws if no orgs are found or multiple orgs exist without an explicit param.
 */
export const resolveOrgId = async (
  client: ApiClient,
  explicitOrgId?: string
): Promise<string> => {
  if (explicitOrgId) return explicitOrgId

  const { data: orgs, error } = await client.listOrgs()
  if (error || !orgs) throw new Error(error?.message || `Failed to list organizations`)

  if (orgs.length === 0) throw new Error(`No organizations found`)

  if (orgs.length === 1) return orgs[0].id

  throw new Error(`Multiple orgs found. Use --org <id> to specify.`)
}
