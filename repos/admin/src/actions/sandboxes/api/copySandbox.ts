import { sandboxApi } from '@TAF/services'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

type TCopySandboxOpts = {
  orgId: string
  id: string
  name: string
}

export const copySandbox = async (opts: TCopySandboxOpts) => {
  const { orgId, id, name } = opts
  const resp = await sandboxApi.copy(orgId, id, name)

  if (resp.error) return { error: resp.error }

  resp.data && upsertSandbox(resp.data)

  return resp
}
