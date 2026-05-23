import { sandboxApi } from '@TTH/services/sandboxApi'
import { setSandboxPorts } from '@TTH/state/accessors'

export const loadPorts = async (
  orgId: string,
  projectId: string,
  sandboxId: string,
  instanceId: string
) => {
  const { data, error } = await sandboxApi.listPorts(
    orgId,
    projectId,
    sandboxId,
    instanceId
  )

  if (error || !data) {
    console.warn(`[loadPorts] Failed for ${instanceId}:`, error?.message)
    return
  }

  setSandboxPorts(instanceId, data)
}
