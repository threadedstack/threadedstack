import type { TSandboxConnectResponse } from '@tdsk/domain'
import type { ApiClient } from '@TSA/services/api'

import { themed } from '@TSA/theme'

export const sandboxConnectPod = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sandboxIdOrAlias: string
): Promise<TSandboxConnectResponse> => {
  process.stdout.write(
    `${themed(`muted`, `Connecting to sandbox "${sandboxIdOrAlias}"...`)}\n`
  )

  const { data: connectResp, error } = await client.connectSandbox(
    orgId,
    projectId,
    sandboxIdOrAlias
  )
  if (error || !connectResp)
    throw new Error(error?.message || `Failed to connect to sandbox`)

  if (!connectResp.podName) throw new Error(`No pod name returned from server`)
  if (!connectResp.sandboxId)
    throw new Error(`Server did not return a resolved sandbox ID`)

  if (!connectResp.workdir) throw new Error(`Server did not return a workdir`)

  process.stdout.write(`${themed(`muted`, `Pod ready.`)}\n`)

  return connectResp as TSandboxConnectResponse
}
