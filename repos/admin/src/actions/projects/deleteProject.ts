import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export type TDeleteProjectResult = {
  success?: boolean
  error?: Error
}

export const deleteProject = async (projectId: string): Promise<TDeleteProjectResult> => {
  const resp = await projectsApi.delete(projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove project from state
  const currentProjects = getProjects() || {}
  const { [projectId]: deleted, ...remainingProjects } = currentProjects
  setProjects(remainingProjects)

  return { success: true }
}
