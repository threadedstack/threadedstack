import type { Secret } from '@tdsk/domain'

import { secretsApi } from '@TAF/services'
import { upsertSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TUpdateSecretOpts = {
  orgId: string
  id: string
  data: Partial<Secret>
  projectId?: string
}

export const updateSecret = async (opts: TUpdateSecretOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await secretsApi.update(orgId, id, data, projectId)
  resp.data && upsertSecret(resp.data)

  return resp
}
