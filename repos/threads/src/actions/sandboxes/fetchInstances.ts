import { sandboxApi } from '@TTH/services/sandboxApi'
import { setSandboxInstances } from '@TTH/state/accessors'

export type TFetchInstancesOpts = {
  orgId: string
  sandboxId: string
  projectId: string
}

export const fetchInstances = async (opts: TFetchInstancesOpts) => {
  const { orgId, sandboxId, projectId } = opts
  const resp = await sandboxApi.listInstances(orgId, projectId, sandboxId)

  if (resp.error) throw new Error(resp.error.message || `Failed to load instances`)

  if (resp.data) setSandboxInstances(sandboxId, resp.data)

  return resp
}
