import { apiKeysApi } from '@TAF/services'
import { setApiKeys } from '@TAF/actions/apiKeys/local/setApiKeys'

export type TFetchApiKeysOpts = {
  orgId: string
  userId?: string
  projectId?: string
  store?: boolean
}

export const fetchApiKeys = async (opts: TFetchApiKeysOpts) => {
  const { orgId, userId, projectId, store = true } = opts
  const params: Record<string, string> = {}
  if (userId) params.userId = userId
  if (projectId) params.projectId = projectId
  const resp = await apiKeysApi.list(
    orgId,
    Object.keys(params).length ? params : undefined
  )

  if (resp.error) return { error: resp.error }

  store && setApiKeys(resp.data)

  return resp
}
