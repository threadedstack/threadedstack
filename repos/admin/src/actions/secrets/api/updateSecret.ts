import type { Secret } from '@tdsk/domain'

import { secretsApi } from '@TAF/services'
import { upsertSecret, upsertOrgSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TUpdateSecretOpts = {
  orgId: string
  id: string
  data: Partial<Secret>
  projectId?: string
}

export const updateSecret = async (opts: TUpdateSecretOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await secretsApi.update(orgId, id, data, projectId)
  if (resp.data) projectId ? upsertSecret(resp.data) : upsertOrgSecret(resp.data)

  return resp
}
