import { sandboxApi } from '@TTH/services/sandboxApi'

export const removePort = async (
  orgId: string,
  projectId: string,
  sandboxId: string,
  instanceId: string,
  port: number
) => {
  const { error } = await sandboxApi.removePort(
    orgId,
    projectId,
    sandboxId,
    port,
    instanceId
  )

  if (error) throw new Error(error.message || `Failed to remove port ${port}`)
}
