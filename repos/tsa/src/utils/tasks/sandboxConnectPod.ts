import type { TSBConnectResp } from '@tdsk/domain'
import type { ApiClient } from '@TSA/services/api'
import type { TInstanceResolution } from '@TSA/types'

import { themed } from '@TSA/theme'

export const sandboxConnectPod = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sandboxIdOrAlias: string,
  instanceOpts?: TInstanceResolution
): Promise<TSBConnectResp> => {
  process.stdout.write(
    `${themed(`muted`, `Connecting to sandbox "${sandboxIdOrAlias}"...`)}\n`
  )

  const { data: connectResp, error } = await client.connectSandbox(
    orgId,
    projectId,
    sandboxIdOrAlias,
    instanceOpts
  )
  if (error || !connectResp)
    throw new Error(error?.message || `Failed to connect to sandbox`)

  if (!connectResp.instanceId) throw new Error(`No instance ID returned from server`)
  if (!connectResp.sandboxId)
    throw new Error(`Server did not return a resolved sandbox ID`)

  if (!connectResp.workdir) throw new Error(`Server did not return a workdir`)

  process.stdout.write(`${themed(`muted`, `Pod ready.`)}\n`)

  return connectResp as TSBConnectResp
}
