import type { TProto } from '@tdsk/domain'

import { sandboxApi } from '@TTH/services/sandboxApi'

export const exposePort = async (
  orgId: string,
  projectId: string,
  sandboxId: string,
  instanceId: string,
  port: number,
  protocol?: TProto
) => {
  const { error } = await sandboxApi.exposePort(orgId, projectId, sandboxId, {
    instanceId,
    port,
    ...(protocol && { protocol }),
  })

  if (error) throw new Error(error.message || `Failed to expose port ${port}`)
}
