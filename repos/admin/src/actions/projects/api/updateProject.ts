import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export type TUpdateProjectOpts = {
  orgId: string
  id: string
  data: {
    name?: string
    gitUrl?: string
    branch?: string
    meta?: Record<string, any>
  }
}

export type TUpdateProjectResult = {
  project?: Project
  error?: Error
}

export const updateProject = async (
  opts: TUpdateProjectOpts
): Promise<TUpdateProjectResult> => {
  const { orgId, id, data } = opts
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
