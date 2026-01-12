import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export type TUpdateProjectInput = {
  name?: string
  gitUrl?: string
  branch?: string
  meta?: Record<string, any>
}

export type TUpdateProjectResult = {
  project?: Project
  error?: Error
}

export const updateProject = async (
  id: string,
  input: TUpdateProjectInput
): Promise<TUpdateProjectResult> => {
  const resp = await projectsApi.update(id, input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update projects state with the updated project
    const currentProjects = getProjects() || {}
    setProjects({ ...currentProjects, [resp.data.id]: resp.data })
  }

  return { project: resp.data }
}
