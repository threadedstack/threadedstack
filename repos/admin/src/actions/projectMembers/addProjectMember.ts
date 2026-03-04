import { projectMembersApi } from '@TAF/services/projectMembersApi'

export type TAddProjectMemberOpts = {
  orgId: string
  projectId: string
  userId: string
  roleType: string
}

export const addProjectMember = async (opts: TAddProjectMemberOpts) => {
  const { orgId, projectId, ...data } = opts
  return projectMembersApi.add(orgId, projectId, data)
}
