import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TDeleteConfigResult = {
  success?: boolean
  error?: Error
}

export const deleteConfig = async (id: string): Promise<TDeleteConfigResult> => {
  const resp = await configsApi.delete(id)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove config from state
  const currentConfigs = getConfigs() || {}
  const { [id]: removed, ...remainingConfigs } = currentConfigs
  setConfigs(remainingConfigs)

  return { success: true }
}
