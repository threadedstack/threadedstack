import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export const createProject = async (opts: Partial<Project>) => {
  const { orgId, ...data } = opts
  const resp = await projectsApi.create(orgId, data)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const currentProjects = getProjects() || {}
    setProjects({ ...currentProjects, [resp.data.id]: resp.data })
  }

  return resp
}
