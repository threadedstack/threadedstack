import type { AuthManager } from '@TSA/services/auth'
import type { ApiClient } from '@TSA/services/api'
import type { TInstanceResolution } from '@TSA/types'

import { themed } from '@TSA/theme'
import { sandboxConnectPod } from '@TSA/utils/tasks/sandboxConnectPod'
import { connectShellWebSocket } from '@TSA/utils/tasks/shellWebSocket'

export type TConnectAndAttachArgs = {
  run?: boolean
  orgId: string
  client: ApiClient
  auth: AuthManager
  projectId: string
  sandboxId: string
  sessionId?: string
  instanceOpts?: TInstanceResolution
}

export const connectAndAttach = async (args: TConnectAndAttachArgs): Promise<void> => {
  const { run, auth, orgId, client, projectId, sandboxId, sessionId, instanceOpts } = args

  const connectResp = await sandboxConnectPod(
    client,
    orgId,
    projectId,
    sandboxId,
    instanceOpts
  )
  const resolvedId = connectResp.sandboxId
  const creds = auth.creds()
  const bearerToken = creds?.apiKey || connectResp.shellToken || creds?.token

  if (!bearerToken) {
    process.stderr.write(
      `${themed(`error`, `Error:`)} No authentication credentials available.\n`
    )
    process.exit(1)
  }

  await connectShellWebSocket({
    run,
    sessionId,
    bearerToken,
    sandboxId: resolvedId,
    proxyUrl: client.proxyUrl,
    insecure: !!creds?.insecure,
    instanceId: connectResp.instanceId,
  })
}
