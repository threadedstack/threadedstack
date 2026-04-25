import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { spawnSsh } from '@TSA/utils/tasks/spawnSsh'
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { sandboxConnect } from '@TSA/utils/tasks/sandboxConnect'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
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

  const proxyUrl = client.proxyUrl.replace(/^http/, `ws`)
  const cols = process.stdout.columns || 80
  const rows = process.stdout.rows || 24
  const wsUrl = `${proxyUrl}/_/sandboxes/${sandboxId}/shell?sessionId=${sessionId}&token=${connectData.shellToken}&cols=${cols}&rows=${rows}`

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
        try {
          const msg = JSON.parse(data)
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
        } catch {
          // Non-JSON text, write to stdout
          process.stdout.write(data)
        }
        return
      }

      // Binary frame → stdout
      if (data instanceof ArrayBuffer) {
        process.stdout.write(Buffer.from(data))
      }
    })

    const onStdinData = (chunk: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk)
      }
    }
    process.stdin.on(`data`, onStdinData)

    const onResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: `resize`,
            cols: process.stdout.columns || 80,
            rows: process.stdout.rows || 24,
          })
        )
      }
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

    ws.addEventListener(`error`, () => {
      process.stdin.off(`data`, onStdinData)
      process.stdout.off(`resize`, onResize)
      if (process.stdin.isTTY) process.stdin.setRawMode(false)
      process.stdin.pause()
      reject(new Error(`WebSocket connection failed`))
    })
  })
}

export const ssh: TTask = {
  name: `ssh`,
  alias: [],
  description: `Connect to a running sandbox via SSH`,
  example: `tsa ssh <sandbox-id> [--org <id>] [--session <id>]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID`,
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
  action: requireAuth(async ({ params, auth, config, options }) => {
    const sandboxId = params.sandbox || options?.[0]
    if (!sandboxId) {
      process.stdout.write(
        `${themed(`warning`, `Usage: tsa ssh <sandbox-id> [--org <id>]`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined)
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

    if (config) saveContext(config, orgId, projectId)

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
    try {
      await sandboxConnect(client, orgId, projectId, sandboxId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const syncCtx = createSyncContext()
    try {
      await autoStartSync(syncCtx, config?.sync, client, orgId, sandboxId)
      if (syncCtx.started) registerSyncCleanup(sandboxId, syncCtx.manager)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      await stopSync(syncCtx, sandboxId)
      process.exit(1)
    }

    try {
      await spawnSsh(sandboxId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      clearSyncCleanup()
      await stopSync(syncCtx, sandboxId)
    }
  }),
}
