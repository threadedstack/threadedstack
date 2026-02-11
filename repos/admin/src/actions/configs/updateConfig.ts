import type { Config } from '@tdsk/domain'

import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TUpdateConfigOpts = {
  orgId: string
  id: string
  data: Partial<Config>
  projectId?: string
}

export type TUpdateConfigResult = {
  config?: Config
  error?: Error
}

export const updateConfig = async (
  opts: TUpdateConfigOpts
): Promise<TUpdateConfigResult> => {
  const { orgId, id, data, projectId } = opts
  const resp = await configsApi.update(orgId, id, data, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update configs state with the updated config
    const currentConfigs = getConfigs() || {}
    setConfigs({ ...currentConfigs, [resp.data.id]: resp.data })
  }

  return { config: resp.data }
}
