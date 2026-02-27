import { projectMembersApi } from '@TAF/services/projectMembersApi'

export type TListProjectMembersOpts = {
  orgId: string
  projectId: string
}

export const listProjectMembers = async (opts: TListProjectMembersOpts) => {
  const { orgId, projectId } = opts
  return projectMembersApi.list(orgId, projectId)
}
