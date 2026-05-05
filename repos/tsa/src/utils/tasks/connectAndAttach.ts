import type { AuthManager } from '@TSA/services/auth'
import type { ApiClient } from '@TSA/services/api'

import { themed } from '@TSA/theme'
import { sandboxConnectPod } from '@TSA/utils/tasks/sandboxConnectPod'
import { connectShellWebSocket } from '@TSA/utils/tasks/shellWebSocket'

export type TConnectAndAttachArgs = {
  client: ApiClient
  auth: AuthManager
  orgId: string
  projectId: string
  sandboxId: string
  sessionId?: string
  run?: boolean
}

export const connectAndAttach = async (args: TConnectAndAttachArgs): Promise<void> => {
  const { run, auth, orgId, client, projectId, sandboxId, sessionId } = args

  const connectResp = await sandboxConnectPod(client, orgId, projectId, sandboxId)
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
    proxyUrl: client.proxyUrl,
    bearerToken,
    sandboxId: resolvedId,
    insecure: !!creds?.insecure,
    sessionId,
    run,
  })
}
