import type { ApiClient } from '@TSA/services/api'

export const resolveOrg = async (client: ApiClient): Promise<string> => {
  const { data: orgs, error } = await client.listOrgs()
  if (error) throw new Error(error.message)
  if (!orgs || orgs.length === 0) throw new Error(`No organizations found`)
  return orgs[0].id
}
