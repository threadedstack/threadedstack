import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export type TFetchProjectResult = {
  project?: Project
  error?: Error
}

export const fetchProject = async (projectId: string): Promise<TFetchProjectResult> => {
  const resp = await projectsApi.get(projectId)
  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update projects state with the fetched project
    const currentProjects = getProjects() || {}
    setProjects({ ...currentProjects, [resp.data.id]: resp.data })
  }

  return { project: resp.data }
}
