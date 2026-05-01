import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { spawnSsh } from '@TSA/utils/tasks/spawnSsh'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { sandboxConnect } from '@TSA/utils/tasks/sandboxConnect'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { resolveSandboxId } from '@TSA/utils/tasks/resolveSandboxId'
import { autoStartSync, createSyncContext, stopSync } from '@TSA/utils/tasks/sandboxSync'
import {
  clearSyncCleanup,
  registerSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'

/**
 * Join an existing shared session via shell WebSocket.
 * Pipes stdin/stdout through the WebSocket binary frames.
 */
const joinShellSession = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sandboxId: string,
  sessionId: string
): Promise<void> => {
  const { data: connectData, error: connectErr } = await client.connectSandbox(
    orgId,
    projectId,
    sandboxId
  )
  if (connectErr || !connectData?.shellToken) {
    throw new Error(connectErr?.message || `Failed to get shell token`)
  }

  if (!connectData.sandboxId)
    throw new Error(`Server did not return a resolved sandbox ID`)
  const resolvedId = connectData.sandboxId
  const proxyUrl = client.proxyUrl.replace(/^http/, `ws`)
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const wsUrl = `${proxyUrl}/_/sandboxes/${resolvedId}/shell?sessionId=${sessionId}&token=${connectData.shellToken}&cols=${cols}&rows=${rows}`

  const ws = new WebSocket(wsUrl)
  ws.binaryType = `arraybuffer`

  await new Promise<void>((resolve, reject) => {
    let connected = false

    ws.addEventListener(`open`, () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(true)
      process.stdin.resume()
    })

    ws.addEventListener(`message`, (event) => {
      const data = event.data
      if (typeof data === `string`) {
        let msg: any
        try {
          msg = JSON.parse(data)
        } catch {
          process.stdout.write(data)
          return
        }

        if (msg.type === `joined` || msg.type === `reconnected`) {
          connected = true
          process.stderr.write(
            `${themed(`success`, `Joined`)} session ${sessionId.slice(0, 12)}\n`
          )
        } else if (msg.type === `error`) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${msg.message}\n`)
        } else if (msg.type === `disconnected`) {
          process.stderr.write(`${themed(`muted`, `Disconnected: ${msg.reason}`)}\n`)
        }
        return
      }

      // Binary frame → stdout
      if (data instanceof ArrayBuffer) {
        process.stdout.write(Buffer.from(data))
      }
    })

    const onStdinData = (chunk: string | BufferSource | Blob) => {
      ws.readyState === WebSocket.OPEN && ws.send(chunk)
    }

    process.stdin.on(`data`, onStdinData)

    const onResize = () => {
      ws.readyState === WebSocket.OPEN &&
        ws.send(
          JSON.stringify({
            type: `resize`,
            rows: process.stdout.rows || 24,
            cols: process.stdout.columns || 80,
          })
        )
    }
    process.stdout.on(`resize`, onResize)

    ws.addEventListener(`close`, () => {
      process.stdin.off(`data`, onStdinData)
      process.stdout.off(`resize`, onResize)
      if (process.stdin.isTTY) process.stdin.setRawMode(false)
      process.stdin.pause()
      if (connected) resolve()
      else reject(new Error(`Connection closed before session was joined`))
    })

    ws.addEventListener(`error`, (event) => {
      process.stdin.off(`data`, onStdinData)
      process.stdout.off(`resize`, onResize)
      if (process.stdin.isTTY) process.stdin.setRawMode(false)
      process.stdin.pause()
      const msg =
        (event as any).message ||
        (event as any).error?.message ||
        `WebSocket connection failed`
      reject(new Error(msg))
    })
  })
}

export const ssh: TTask = {
  name: `ssh`,
  alias: [],
  description: `Connect to a running sandbox via SSH`,
  example: `tsa ssh <sandbox> [--org <id>] [--session <id>]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID or alias`,
      alias: [`sandboxId`, `sb`],
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
    project: {
      example: `--project proj_xxx`,
      description: `Project ID`,
      alias: [`projectId`, `p`],
    },
    session: {
      alias: [`s`],
      description: `Join an existing shared session by ID (connects via shell WebSocket instead of SSH tunnel)`,
      example: `tsa ssh sb_abc --session sess_xy12ab`,
    },
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const explicitSandboxId = params.sandbox || options?.[0]
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const explicitProject =
      orgId !== config?.org ? undefined : (params.project as string | undefined)

    let projectId: string
    try {
      projectId = await resolveProjectId(client, orgId, explicitProject)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    let sandboxId: string
    try {
      sandboxId = await resolveSandboxId(
        client,
        orgId,
        projectId,
        explicitSandboxId as string | undefined,
        config?.sandbox
      )
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (config) saveContext(config, orgId, projectId, sandboxId)

    // Session join path: connect via shell WebSocket instead of native SSH
    const sessionId = params.session as string | undefined
    if (sessionId) {
      try {
        await joinShellSession(client, orgId, projectId, sandboxId, sessionId)
      } catch (err) {
        process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
        process.exitCode = 1
      }
      return
    }

    // Normal SSH path
    let resolvedId: string
    let shellToken: string | undefined
    try {
      const connectResp = await sandboxConnect(client, orgId, projectId, sandboxId)
      if (!connectResp.sandboxId)
        throw new Error(`Server did not return a resolved sandbox ID`)
      resolvedId = connectResp.sandboxId
      shellToken = connectResp.shellToken
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (!shellToken && !auth.creds()?.apiKey) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} Server did not return a tunnel token and no API key is configured.\n` +
          `${themed(`muted`, `Run "tsa login <api-key>" or update the server to resolve this.`)}\n`
      )
      process.exit(1)
    }

    const syncCtx = createSyncContext()
    try {
      await autoStartSync(syncCtx, config?.sync, client, orgId, resolvedId)
      if (syncCtx.started) registerSyncCleanup(resolvedId, syncCtx.manager)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      await stopSync(syncCtx, resolvedId)
      process.exit(1)
    }

    try {
      await spawnSsh(resolvedId, undefined, shellToken)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      clearSyncCleanup()
      await stopSync(syncCtx, resolvedId)
    }
  }),
}
