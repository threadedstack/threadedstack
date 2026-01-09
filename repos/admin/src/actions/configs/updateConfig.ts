import type { Config } from '@tdsk/domain'

import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TUpdateConfigResult = {
  config?: Config
  error?: Error
}

export const updateConfig = async (
  id: string,
  input: Partial<Config>
): Promise<TUpdateConfigResult> => {
  const resp = await configsApi.update(id, input)

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
