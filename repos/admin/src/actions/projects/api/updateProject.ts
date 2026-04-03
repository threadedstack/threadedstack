import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { setProjects, getProjects } from '@TAF/state/accessors'

export const updateProject = async (opts: Partial<Project>) => {
  const { orgId, id, ...data } = opts
  const resp = await projectsApi.update(orgId, id, data)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    const currentProjects = getProjects() || {}
    setProjects({ ...currentProjects, [resp.data.id]: resp.data })
    query.client.invalidateQueries({ queryKey: projectsApi.cache.list(orgId) })
    query.updateDetailCache(projectsApi.cache.detail(id), resp.data)
  }

  return { project: resp.data }
}
