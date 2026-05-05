import type { TTask } from '@TSA/types'
import type { TSandboxSession } from '@tdsk/domain'

import WebSocket from 'ws'
import { themed } from '@TSA/theme'
import { EShellMsg } from '@tdsk/domain'
import { ApiClient } from '@TSA/services/api'
import { SandboxOptions } from '@TSA/constants/options'
import { ShellConnectMsgs } from '@TSA/constants/shell'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveSessionId } from '@TSA/utils/tasks/resolveSessionId'
import { connectAndAttach } from '@TSA/utils/tasks/connectAndAttach'

const resolveSessionSandbox = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sessionId: string
): Promise<{ sandboxId: string; session: TSandboxSession } | undefined> => {
  const { data: sandboxes, error: listError } = await client.listSandboxes(
    orgId,
    projectId
  )
  if (listError || !sandboxes) {
    throw new Error(listError?.message || `Failed to list sandboxes`)
  }

  for (const sb of sandboxes) {
    const { data: sessions, error: sessError } = await client.getSandboxSessions(
      orgId,
      projectId,
      sb.id
    )
    if (sessError) {
      process.stderr.write(
        `${themed(`warning`, `Warning:`)} Could not check sessions for sandbox ${sb.id}: ${sessError.message}\n`
      )
      continue
    }
    const match = sessions?.find((s) => s.sessionId === sessionId)
    if (match) return { sandboxId: sb.id, session: match }
  }

  return undefined
}

const changeVisibility = async (
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
    resolved.sandboxId
  )
  if (connectErr || !connectData?.shellToken) {
    process.stderr.write(
      `${themed(`error`, `Error:`)} ${connectErr?.message || `Failed to get shell token`}\n`
    )
    process.exit(1)
  }

  const wsBase = client.proxyUrl.replace(/^https:/, `wss:`).replace(/^http:/, `ws:`)
  const wsUrl = `${wsBase}/_/sandboxes/${resolved.sandboxId}/shell?sessionId=${sessionId}`
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

export const sessions: TTask = {
  name: `sessions`,
  alias: [`session`],
  description: `List active sessions for a sandbox`,
  example: `tsa sessions <sandbox-id> [--org <id>] [--project <id>]`,
  options: { ...SandboxOptions },
  tasks: {
    list: {
      name: `list`,
      alias: [`ls`],
      description: `List active sessions for a sandbox`,
      example: `tsa sessions list <sandbox-id>`,
      options: { ...SandboxOptions },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const client = new ApiClient(auth)
        const ctx = await resolveContext({
          client,
          config,
          explicitOrg: params.org as string | undefined,
          explicitProject: params.project as string | undefined,
          explicitSandbox: (params.sandbox || options?.[0]) as string | undefined,
        })

        const { data: sessionList, error } = await client.getSandboxSessions(
          ctx.orgId,
          ctx.projectId,
          ctx.sandboxId
        )
        if (error) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${error.message}\n`)
          process.exit(1)
        }

        const list = sessionList ?? []
        if (list.length === 0) {
          process.stdout.write(
            `${themed(`muted`, `No active sessions for sandbox ${ctx.sandboxId}`)}\n`
          )
          return
        }

        process.stdout.write(
          `\n${themed(`bold`, `Sessions for sandbox ${ctx.sandboxId}`)} (${list.length} active)\n\n`
        )

        const idW = 16
        const ownerW = 20
        const visW = 10
        process.stdout.write(
          `  ${'ID'.padEnd(idW)} ${'Owner'.padEnd(ownerW)} ${'Visibility'.padEnd(visW)} Connected\n`
        )
        process.stdout.write(
          `  ${'─'.repeat(idW)} ${'─'.repeat(ownerW)} ${'─'.repeat(visW)} ${'─'.repeat(20)}\n`
        )

        for (const s of list) {
          const id = s.sessionId.slice(0, 14).padEnd(idW)
          const owner = s.userId.slice(0, 18).padEnd(ownerW)
          const vis = s.visibility.padEnd(visW)
          process.stdout.write(
            `  ${themed(`muted`, id)} ${owner} ${vis} ${themed(`muted`, s.connectedAt)}\n`
          )
        }
        process.stdout.write(`\n`)
      }),
    },
    start: {
      name: `start`,
      alias: [`new`],
      description: `Start a new plain shell session`,
      example: `tsa sessions start <sandbox-id>`,
      options: { ...SandboxOptions },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const sandboxIdInput = (params.sandbox || options?.[0]) as string | undefined
        if (!sandboxIdInput) {
          process.stderr.write(`Usage: tsa sessions start <sandbox-id>\n`)
          process.exit(1)
        }

        const client = new ApiClient(auth)
        const ctx = await resolveContext({
          client,
          config,
          explicitOrg: params.org as string | undefined,
          explicitProject: params.project as string | undefined,
          explicitSandbox: sandboxIdInput,
        })

        try {
          await connectAndAttach({
            client,
            auth,
            orgId: ctx.orgId,
            projectId: ctx.projectId,
            sandboxId: ctx.sandboxId,
            run: false,
          })
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exitCode = 1
        }
      }),
    },
    connect: {
      name: `connect`,
      alias: [`join`, `attach`],
      description: `Connect to an existing session`,
      example: `tsa sessions connect <session-id>`,
      options: { ...SandboxOptions },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const sessionId = options?.[0] as string | undefined
        if (!sessionId) {
          process.stderr.write(`Usage: tsa sessions connect <session-id>\n`)
          process.exit(1)
        }

        const client = new ApiClient(auth)
        const base = await resolveContext({
          client,
          config,
          explicitOrg: params.org as string | undefined,
          explicitProject: params.project as string | undefined,
          skipSandbox: true,
        })

        let sandboxId = params.sandbox as string | undefined
        if (!sandboxId) {
          const result = await resolveSessionSandbox(
            client,
            base.orgId,
            base.projectId,
            sessionId
          )
          if (!result) {
            process.stderr.write(
              `${themed(`error`, `Error:`)} Could not find session ${sessionId} in any sandbox\n`
            )
            process.exit(1)
          }
          sandboxId = result.sandboxId
        }

        if (config) saveContext(config, base.orgId, base.projectId, sandboxId)

        try {
          await connectAndAttach({
            client,
            auth,
            orgId: base.orgId,
            projectId: base.projectId,
            sandboxId,
            sessionId,
          })
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exitCode = 1
        }
      }),
    },
    share: {
      name: `share`,
      description: `Make a session public (shareable with project members)`,
      example: `tsa sessions share [<session-id>] [--org <id>] [--project <id>]`,
      options: { ...SandboxOptions },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const explicitSessionId = options?.[0] as string | undefined
        const client = new ApiClient(auth)
        const ctx = await resolveContext({
          client,
          config,
          explicitOrg: params.org as string | undefined,
          explicitProject: params.project as string | undefined,
          explicitSandbox: params.sandbox as string | undefined,
        })

        let sessionId: string
        try {
          sessionId = await resolveSessionId(
            client,
            ctx.orgId,
            ctx.projectId,
            ctx.sandboxId,
            explicitSessionId
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }

        try {
          const creds = auth.creds()
          await changeVisibility(
            client,
            ctx.orgId,
            ctx.projectId,
            sessionId,
            `public`,
            creds
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }
      }),
    },
    unshare: {
      name: `unshare`,
      description: `Make a session private`,
      example: `tsa sessions unshare [<session-id>] [--org <id>] [--project <id>]`,
      options: { ...SandboxOptions },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const explicitSessionId = options?.[0] as string | undefined
        const client = new ApiClient(auth)
        const ctx = await resolveContext({
          client,
          config,
          explicitOrg: params.org as string | undefined,
          explicitProject: params.project as string | undefined,
          explicitSandbox: params.sandbox as string | undefined,
        })

        let sessionId: string
        try {
          sessionId = await resolveSessionId(
            client,
            ctx.orgId,
            ctx.projectId,
            ctx.sandboxId,
            explicitSessionId
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }

        try {
          const creds = auth.creds()
          await changeVisibility(
            client,
            ctx.orgId,
            ctx.projectId,
            sessionId,
            `private`,
            creds
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }
      }),
    },
  },
  action: async (ctx) => {
    const list = sessions.tasks?.list?.action
    if (list) await list(ctx)
  },
}
