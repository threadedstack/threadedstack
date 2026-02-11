import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export type TDeleteProjectOpts = {
  orgId: string
  id: string
}

export type TDeleteProjectResult = {
  success?: boolean
  error?: Error
}

export const deleteProject = async (
  opts: TDeleteProjectOpts
): Promise<TDeleteProjectResult> => {
  const { orgId, id } = opts
  const resp = await projectsApi.delete(orgId, id)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove project from state
  const currentProjects = getProjects() || {}
  const { [id]: deleted, ...remainingProjects } = currentProjects
  setProjects(remainingProjects)

  return { success: true }
}
