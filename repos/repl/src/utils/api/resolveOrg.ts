import type { ApiClient } from '@TRL/services/api'

export const resolveOrg = async (client: ApiClient): Promise<string> => {
  const orgs = (await client.listOrgs()) as any[]
  if (orgs.length === 0) throw new Error(`No organizations found`)
  return orgs[0].id
}
