import { sandboxApi } from '@TAF/services'

export type TStartSandboxOpts = {
  orgId: string
  sandboxId: string
  projectId?: string
}

export const startSandbox = async (opts: TStartSandboxOpts) => {
  const { orgId, sandboxId, projectId } = opts
  return sandboxApi.start(orgId, sandboxId, projectId ? { projectId } : undefined)
}
