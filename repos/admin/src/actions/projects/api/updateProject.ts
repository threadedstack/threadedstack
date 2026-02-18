import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export const updateProject = async (opts: Partial<Project>) => {
  const { orgId, id, ...data } = opts
  const resp = await projectsApi.update(orgId, id, data)

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
