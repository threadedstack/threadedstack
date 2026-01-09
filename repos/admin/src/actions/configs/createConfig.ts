import type { TConfig } from '@TAF/state/configs'

import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TCreateConfigInput = {
  name: string
  data: Record<string, any>
  teamId?: string
  repoId?: string
  userId?: string
}

export type TCreateConfigResult = {
  config?: TConfig
  error?: Error
}

export const createConfig = async (input: TCreateConfigInput): Promise<TCreateConfigResult> => {
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
