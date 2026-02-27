import { projectMembersApi } from '@TAF/services/projectMembersApi'

export type TRemoveProjectMemberOpts = {
  orgId: string
  projectId: string
  userId: string
}

export const removeProjectMember = async (opts: TRemoveProjectMemberOpts) => {
  const { orgId, projectId, userId } = opts
  return projectMembersApi.remove(orgId, projectId, userId)
}
