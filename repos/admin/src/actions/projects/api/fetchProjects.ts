import type { Project } from '@tdsk/domain'

import { projectsApi } from '@TAF/services'
import { setProjects } from '@TAF/state/accessors'

export type TFetchProjectsResult = {
  projects?: Record<string, Project>
  error?: Error
}

export type TFetchProjectsOpts = {
  orgId: string
}

export const fetchProjects = async (
  opts: TFetchProjectsOpts
): Promise<TFetchProjectsResult> => {
  const resp = await projectsApi.list(opts.orgId)

  if (resp.error) return resp

  setProjects(resp.data)
  return { projects: resp.data }
}
