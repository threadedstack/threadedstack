import { projectMembersApi } from '@TAF/services/projectMembersApi'
import { removeProjectMemberLocal } from '@TAF/actions/projectMembers/local/removeProjectMember'

export type TRemoveProjectMemberOpts = {
  orgId: string
  projectId: string
  userId: string
}

export const removeProjectMember = async (opts: TRemoveProjectMemberOpts) => {
  const { orgId, projectId, userId } = opts
  const resp = await projectMembersApi.remove(orgId, projectId, userId)
  if (resp.error) return { error: resp.error }
  removeProjectMemberLocal(projectId, userId)
  return resp
}
