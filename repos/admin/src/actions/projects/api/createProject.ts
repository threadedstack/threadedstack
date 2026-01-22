import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export type TCreateProjectInput = {
  name: string
  orgId: string
  gitUrl?: string
  branch?: string
}

export type TCreateProjectResult = {
  project?: Project
  error?: Error
}

export const createProject = async (
  input: TCreateProjectInput
): Promise<TCreateProjectResult> => {
  const resp = await projectsApi.create(input)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update projects state with the new project
    const currentProjects = getProjects() || {}
    setProjects({ ...currentProjects, [resp.data.id]: resp.data })
  }

  return { project: resp.data }
}
