import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TFetchConfigOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const fetchConfig = async (opts: TFetchConfigOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await configsApi.get(orgId, id, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update configs state with the fetched config
    const currentConfigs = getConfigs() || {}
    setConfigs({ ...currentConfigs, [resp.data.id]: resp.data })
  }

  return resp
}
