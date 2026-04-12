import { projectsApi } from '@TTH/services/projectsApi'

export type TListProjectsOpts = { orgId: string }

export const listProjects = async (opts: TListProjectsOpts) => {
  return projectsApi.list(opts.orgId)
}
