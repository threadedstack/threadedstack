import type { Role } from '@tdsk/domain'
import { setProjectMembersForProject } from '@TAF/state/accessors'

export const setProjectMembers = (projectId: string, members: Role[]) => {
  const map = members.reduce(
    (acc, role) => {
      acc[role.id] = role
      return acc
    },
    {} as Record<string, Role>
  )
  setProjectMembersForProject(projectId, map)
}
