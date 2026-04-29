import type { TSandboxConnectResponse } from '@tdsk/domain'
import type { ApiClient } from '@TSA/services/api'

import { themed } from '@TSA/theme'
import { ensureSshConfig, getPublicKey } from '@TSA/services/sync/sshConfig'

/**
 * Connects to a sandbox pod, ensures SSH config, and injects the public key.
 * Throws on any failure so callers can run cleanup in finally blocks.
 */
export const sandboxConnect = async (
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

  const { podName } = connectResp
  if (!podName) throw new Error(`No pod name returned from server`)

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
    podName,
    publicKey
  )
  if (sshError) {
    throw new Error(`SSH key injection failed: ${sshError.message}`)
  }

  process.stdout.write(`${themed(`muted`, `SSH session ready.`)}\n`)

  return connectResp as TSandboxConnectResponse
}
