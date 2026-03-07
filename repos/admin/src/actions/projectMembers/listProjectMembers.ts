import { projectMembersApi } from '@TAF/services/projectMembersApi'
import { setProjectMembers } from '@TAF/actions/projectMembers/local/setProjectMembers'

export type TListProjectMembersOpts = {
  orgId: string
  projectId: string
}

export const listProjectMembers = async (opts: TListProjectMembersOpts) => {
  const { orgId, projectId } = opts
  const resp = await projectMembersApi.list(orgId, projectId)
  if (resp.error) return { error: resp.error }
  resp.data && setProjectMembers(projectId, resp.data)
  return resp
}
