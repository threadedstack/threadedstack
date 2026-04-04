import type { Sandbox } from '@tdsk/domain'

import { sandboxApi } from '@TAF/services'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

export type TUpdateSandboxOpts = {
  id: string
  orgId: string
  projectId?: string
  data: Partial<Sandbox>
}

export const updateSandbox = async (opts: TUpdateSandboxOpts) => {
  const { orgId, id, projectId, data } = opts
  const resp = await sandboxApi.update(orgId, id, {
    ...data,
    ...(projectId && { projectId }),
  })

  if (resp.error) return { error: resp.error }

  resp.data && upsertSandbox(resp.data)

  return resp
}
