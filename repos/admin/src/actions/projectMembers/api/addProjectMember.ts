import type { TPermissionOverrides } from '@tdsk/domain'

import { query } from '@TAF/services/query'
import { listProjectMembers } from './listProjectMembers'
import { projectMembersApi } from '@TAF/services/projectMembersApi'

export type TAddProjectMemberOpts = {
  orgId: string
  email?: string
  userId?: string
  roleType: string
  projectId: string
  permissionOverrides?: TPermissionOverrides
}

export const addProjectMember = async (opts: TAddProjectMemberOpts) => {
  const { orgId, projectId, ...data } = opts
  const resp = await projectMembersApi.add(orgId, projectId, data)
  if (resp.error) return { error: resp.error }

  // TODO: Validate if this is needed. It should not be
  // Clear cached query so re-fetch gets fresh data from server
  query.client.removeQueries({ queryKey: [`projectMembers`, orgId, projectId] })
  const refreshResp = await listProjectMembers({ orgId, projectId })
  if (refreshResp.error)
    console.warn(`[addProjectMember] Failed to refresh member list:`, refreshResp.error)
  return resp
}
