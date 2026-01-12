import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects } from '@TAF/state/accessors'

export type TFetchProjectsResult = {
  projects?: Record<string, Project>
  error?: Error
}

export type TFetchProjects = {
  orgId?: string
}

export const fetchProjects = async (
  opts?: TFetchProjects
): Promise<TFetchProjectsResult> => {
  const resp = opts?.orgId
    ? await projectsApi.listByOrg(opts?.orgId)
    : await projectsApi.list()

  if (resp.error) return resp

  setProjects(resp.data)
  return { projects: resp.data }
}
