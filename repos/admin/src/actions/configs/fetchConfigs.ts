import type { TConfig } from '@TAF/state/configs'

import { configsApi } from '@TAF/services'
import { setConfigs } from '@TAF/state/accessors'

export type TFetchConfigsResult = {
  configs?: Record<string, TConfig>
  error?: Error
}

export const fetchConfigs = async (filters?: {
  teamId?: string
  repoId?: string
}): Promise<TFetchConfigsResult> => {
  const resp = await configsApi.list(filters)

  if (resp.error) {
    return { error: resp.error }
  }

  const configsMap =
    resp.data?.reduce((acc: Record<string, TConfig>, config: TConfig) => {
      acc[config.id] = config
      return acc
    }, {}) || {}

  setConfigs(configsMap)
  return { configs: configsMap }
}
