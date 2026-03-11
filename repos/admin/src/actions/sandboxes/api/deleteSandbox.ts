import { sandboxApi } from '@TAF/services'
import { removeSandbox } from '@TAF/actions/sandboxes/local/removeSandbox'

export type TDeleteSandboxOpts = {
  orgId: string
  id: string
}

export const deleteSandbox = async (opts: TDeleteSandboxOpts) => {
  const { orgId, id } = opts
  const resp = await sandboxApi.delete(orgId, id)

  if (resp.error) return { error: resp.error }
  removeSandbox(id)
  return { success: resp.data }
}
