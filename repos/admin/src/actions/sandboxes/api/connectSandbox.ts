import { sandboxApi } from '@TAF/services'

export type TConnectSandboxOpts = {
  orgId: string
  podName?: string
  sandboxId: string
  projectId: string
  newInstance?: boolean
}

export const connectSandbox = async (opts: TConnectSandboxOpts) => {
  const { orgId, podName, projectId, sandboxId, newInstance } = opts

  return sandboxApi.connect(orgId, projectId, sandboxId, {
    ...(newInstance ? { newInstance } : {}),
    ...(podName ? { podName } : {}),
  })
}
