import WebSocket from 'ws'
import { themed } from '@TSA/theme'
import { EShellMsg } from '@tdsk/domain'
import type { ApiClient } from '@TSA/services/api'
import { ShellConnectMsgs } from '@TSA/constants/shell'
import { resolveSessionSandbox } from '@TSA/utils/sandbox/resolveSessionSandbox'

export const changeVisibility = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sessionId: string,
  visibility: `public` | `private`,
  creds?: { apiKey?: string; token?: string; insecure?: boolean }
): Promise<void> => {
  const resolved = await resolveSessionSandbox(client, orgId, projectId, sessionId)
  if (!resolved) {
    process.stderr.write(`${themed(`error`, `Error:`)} Session ${sessionId} not found\n`)
    process.exit(1)
  }

  const { data: connectData, error: connectErr } = await client.connectSandbox(
    orgId,
    projectId,
    resolved.sandboxId,
    { instanceId: resolved.session.instanceId }
  )
  if (connectErr || !connectData?.shellToken) {
    process.stderr.write(
      `${themed(`error`, `Error:`)} ${connectErr?.message || `Failed to get shell token`}\n`
    )
    process.exit(1)
  }

  const wsBase = client.proxyUrl.replace(/^https:/, `wss:`).replace(/^http:/, `ws:`)
  const wsUrl = `${wsBase}/_/sandboxes/${resolved.sandboxId}/shell?sessionId=${sessionId}&instanceId=${resolved.session.instanceId}`
  const bearerToken = creds?.apiKey || connectData.shellToken || creds?.token
  if (!bearerToken) {
    process.stderr.write(
      `${themed(`error`, `Error:`)} No authentication credentials available\n`
    )
    process.exit(1)
  }

  const ws = new WebSocket(wsUrl, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    rejectUnauthorized: !creds?.insecure,
  })

  await new Promise<void>((resolve, reject) => {
    let confirmed = false

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error(`Timed out waiting for visibility confirmation`))
    }, 10_000)

    ws.on(`message`, (data: Buffer | string) => {
      const text = typeof data === `string` ? data : data.toString(`utf8`)
      let msg: any
      try {
        msg = JSON.parse(text)
      } catch {
        return
      }

      if (ShellConnectMsgs.includes(msg.type)) {
        ws.send(JSON.stringify({ type: EShellMsg.Visibility, visibility }))
      } else if (msg.type === EShellMsg.Visibility) {
        confirmed = true
        clearTimeout(timeout)
        process.stdout.write(
          `${themed(`success`, `Done:`)} Session ${sessionId.slice(0, 12)} is now ${themed(`bold`, visibility)}\n`
        )
        ws.close()
        resolve()
      } else if (msg.type === EShellMsg.Error) {
        clearTimeout(timeout)
        ws.close()
        reject(new Error(msg.message || `Server error`))
      }
    })

    ws.on(`error`, (err: Error) => {
      clearTimeout(timeout)
      reject(new Error(err.message || `WebSocket connection failed`))
    })

    ws.on(`close`, () => {
      clearTimeout(timeout)
      if (!confirmed) {
        reject(new Error(`Connection closed before visibility was confirmed`))
      }
    })
  })
}
