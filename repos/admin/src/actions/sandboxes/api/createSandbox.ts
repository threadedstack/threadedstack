import type { Sandbox } from '@tdsk/domain'

import { sandboxApi } from '@TAF/services'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

export type TCreateSandboxOpts = {
  orgId: string
  projectId?: string
  data: Partial<Sandbox>
}

export const createSandbox = async (opts: TCreateSandboxOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await sandboxApi.create(orgId, {
    ...data,
    ...(projectId && { projectId }),
  })

  if (resp.error) return { error: resp.error }

  resp.data && upsertSandbox(resp.data)

  return resp
}
