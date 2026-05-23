import type { TSBConnectResp } from '@tdsk/domain'
import type { ApiClient } from '@TSA/services/api'
import type { TInstanceResolution } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ensureSshConfig, getPublicKey } from '@TSA/services/sync/sshConfig'

export const sandboxConnect = async (
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

  const { instanceId } = connectResp
  if (!instanceId) throw new Error(`No instance ID returned from server`)

  let publicKey: string
  try {
    ensureSshConfig()
    publicKey = getPublicKey()
  } catch (err) {
    throw new Error(`Failed to configure SSH: ${(err as Error).message}`)
  }

  if (!connectResp.sandboxId)
    throw new Error(`Server did not return a resolved sandbox ID`)

  const resolvedId = connectResp.sandboxId
  const { error: sshError } = await client.injectSshKey(
    orgId,
    projectId,
    resolvedId,
    instanceId,
    publicKey
  )
  if (sshError) {
    throw new Error(`SSH key injection failed: ${sshError.message}`)
  }

  process.stdout.write(`${themed(`muted`, `SSH session ready.`)}\n`)

  return connectResp as TSBConnectResp
}
