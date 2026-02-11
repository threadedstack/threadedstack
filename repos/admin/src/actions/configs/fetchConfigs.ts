import type { Config } from '@tdsk/domain'

import { configsApi } from '@TAF/services'
import { setConfigs } from '@TAF/state/accessors'

export type TFetchConfigsOpts = {
  orgId: string
  projectId?: string
}

export type TFetchConfigsResult = {
  configs?: Record<string, Config>
  error?: Error
}

export const fetchConfigs = async (
  opts: TFetchConfigsOpts
): Promise<TFetchConfigsResult> => {
  const { orgId, projectId } = opts
  const resp = await configsApi.list(orgId, projectId)

  if (resp.error) {
    return { error: resp.error }
  }

  const configsMap =
    resp.data?.reduce((acc: Record<string, Config>, config: Config) => {
      acc[config.id] = config
      return acc
    }, {}) || {}

  setConfigs(configsMap)
  return { configs: configsMap }
}
