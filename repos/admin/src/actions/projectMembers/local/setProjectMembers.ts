import type { Role } from '@tdsk/domain'
import { setProjectMembersForProject } from '@TAF/state/accessors'

export const setProjectMembers = (projectId: string, members: Role[]) => {
  const map = Object.fromEntries(members.map((role) => [role.id, role])) as Record<
    string,
    Role
  >
  setProjectMembersForProject(projectId, map)
}
