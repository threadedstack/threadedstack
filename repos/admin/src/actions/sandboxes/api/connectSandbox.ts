import { sandboxApi } from '@TAF/services'

export type TConnectSandboxOpts = {
  orgId: string
  sandboxId: string
  projectId: string
  instanceId?: string
  newInstance?: boolean
}

export const connectSandbox = async (opts: TConnectSandboxOpts) => {
  const { orgId, instanceId, projectId, sandboxId, newInstance } = opts

  return sandboxApi.connect(orgId, projectId, sandboxId, {
    ...(newInstance ? { newInstance } : {}),
    ...(instanceId ? { instanceId } : {}),
  })
}
