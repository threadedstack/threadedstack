import type { Config } from '@tdsk/domain'

import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TCreateConfigOpts = {
  orgId: string
  data: Partial<Config>
  projectId?: string
}

export type TCreateConfigResult = {
  config?: Config
  error?: Error
}

export const createConfig = async (
  opts: TCreateConfigOpts
): Promise<TCreateConfigResult> => {
  const { orgId, data, projectId } = opts
  const resp = await configsApi.create(orgId, data, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update configs state with the new config
    const currentConfigs = getConfigs() || {}
    setConfigs({ ...currentConfigs, [resp.data.id]: resp.data })
  }

  return { config: resp.data }
}
