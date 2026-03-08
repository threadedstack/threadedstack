import { projectsApi } from '@TAF/services'
import { setProjects } from '@TAF/state/accessors'

export type TFetchProjectsOpts = {
  orgId: string
}

export const fetchProjects = async (opts: TFetchProjectsOpts) => {
  const resp = await projectsApi.list(opts.orgId)
  if (resp.error) return resp

  resp.data && setProjects(resp.data)
  return resp
}
