import { projectsApi } from '@TAF/services'
import { setProjects, getProjects } from '@TAF/state/accessors'

export type TFetchProjectOpts = {
  orgId: string
  id: string
}

export const fetchProject = async (opts: TFetchProjectOpts) => {
  const { orgId, id } = opts
  const resp = await projectsApi.get(orgId, id)
  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update projects state with the fetched project
    const currentProjects = getProjects() || {}
    setProjects({ ...currentProjects, [resp.data.id]: resp.data })
  }

  return resp
}
