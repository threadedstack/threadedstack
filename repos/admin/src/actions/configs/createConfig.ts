import type { Config } from '@tdsk/domain'

import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TCreateConfigResult = {
  config?: Config
  error?: Error
}

export const createConfig = async (
  input: Partial<Config>
): Promise<TCreateConfigResult> => {
  const resp = await configsApi.create(input)

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
