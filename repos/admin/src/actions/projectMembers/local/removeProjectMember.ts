import {
  getProjectMembersForProject,
  setProjectMembersForProject,
} from '@TAF/state/accessors'

export const removeProjectMemberLocal = (projectId: string, userId: string) => {
  const current = getProjectMembersForProject(projectId) || {}
  const filtered = Object.fromEntries(
    Object.entries(current).filter(([_, role]) => role.userId !== userId)
  )
  setProjectMembersForProject(projectId, filtered)
}
