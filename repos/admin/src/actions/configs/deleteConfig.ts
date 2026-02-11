import { configsApi } from '@TAF/services'
import { setConfigs, getConfigs } from '@TAF/state/accessors'

export type TDeleteConfigOpts = {
  orgId: string
  id: string
  projectId?: string
}

export type TDeleteConfigResult = {
  success?: boolean
  error?: Error
}

export const deleteConfig = async (
  opts: TDeleteConfigOpts
): Promise<TDeleteConfigResult> => {
  const { orgId, id, projectId } = opts
  const resp = await configsApi.delete(orgId, id, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove config from state
  const currentConfigs = getConfigs() || {}
  const { [id]: removed, ...remainingConfigs } = currentConfigs
  setConfigs(remainingConfigs)

  return { success: true }
}
