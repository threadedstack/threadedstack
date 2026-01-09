import type { TConfig } from '@TAF/state/configs'

import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TFetchConfigResult = {
  config?: TConfig
  error?: Error
}

export const fetchConfig = async (id: string): Promise<TFetchConfigResult> => {
  const resp = await configsApi.get(id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update configs state with the fetched config
    const currentConfigs = getConfigs() || {}
    setConfigs({ ...currentConfigs, [resp.data.id]: resp.data })
  }

  return { config: resp.data }
}
