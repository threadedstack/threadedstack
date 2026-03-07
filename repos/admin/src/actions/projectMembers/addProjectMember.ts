import { query } from '@TAF/services/query'
import { projectMembersApi } from '@TAF/services/projectMembersApi'
import { listProjectMembers } from '@TAF/actions/projectMembers/listProjectMembers'

export type TAddProjectMemberOpts = {
  orgId: string
  projectId: string
  userId: string
  roleType: string
}

export const addProjectMember = async (opts: TAddProjectMemberOpts) => {
  const { orgId, projectId, ...data } = opts
  const resp = await projectMembersApi.add(orgId, projectId, data)
  if (resp.error) return { error: resp.error }
  // Clear cached query so re-fetch gets fresh data from server
  query.client.removeQueries({ queryKey: [`projectMembers`, orgId, projectId] })
  await listProjectMembers({ orgId, projectId })
  return resp
}
