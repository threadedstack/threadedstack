import { secretsApi } from '@TAF/services'
import { removeSecret, removeOrgSecret } from '@TAF/actions/secrets/local/removeSecret'

export type TDeleteSecretOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const deleteSecret = async (opts: TDeleteSecretOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await secretsApi.delete(orgId, id, projectId)
  if (resp.error) return { error: resp.error }

  projectId ? removeSecret(id) : removeOrgSecret(id)
  return { success: true }
}
