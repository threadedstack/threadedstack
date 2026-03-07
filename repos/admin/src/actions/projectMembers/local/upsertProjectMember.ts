import type { Role } from '@tdsk/domain'
import {
  getProjectMembersForProject,
  setProjectMembersForProject,
} from '@TAF/state/accessors'

export const upsertProjectMember = (projectId: string, role: Role) => {
  const current = getProjectMembersForProject(projectId) || {}
  setProjectMembersForProject(projectId, { ...current, [role.id]: role })
}
