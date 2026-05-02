import type { TTask } from '@TSA/types'
import type { TSandboxSession } from '@tdsk/domain'

import WebSocket from 'ws'
import { themed } from '@TSA/theme'
import { EShellMsg } from '@tdsk/domain'
import { ApiClient } from '@TSA/services/api'
import { ShellConnectMsgs } from '@TSA/constants/shell'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { resolveSandboxId } from '@TSA/utils/tasks/resolveSandboxId'
import { resolveSessionId } from '@TSA/utils/tasks/resolveSessionId'
import { sandboxConnectPod } from '@TSA/utils/tasks/sandboxConnectPod'
import { connectShellWebSocket } from '@TSA/utils/tasks/shellWebSocket'

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
  },
  tasks: {
    list: {
      name: `list`,
      alias: [`ls`],
      description: `List active sessions for a sandbox`,
      example: `tsa sessions list <sandbox-id>`,
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
      },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const explicitSandboxId = params.sandbox || options?.[0]
        const client = new ApiClient(auth)

        let orgId: string
        try {
          orgId = await resolveOrgId(
            client,
            params.org as string | undefined,
            config?.org
          )
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

        const { data: sessionList, error } = await client.getSandboxSessions(
          orgId,
          projectId,
          sandboxId
        )
        if (error) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${error.message}\n`)
          process.exit(1)
        }

        const list = sessionList ?? []
        if (list.length === 0) {
          process.stdout.write(
            `${themed(`muted`, `No active sessions for sandbox ${sandboxId}`)}\n`
          )
          return
        }

        process.stdout.write(
          `\n${themed(`bold`, `Sessions for sandbox ${sandboxId}`)} (${list.length} active)\n\n`
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
      },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const sandboxIdInput = (params.sandbox || options?.[0]) as string | undefined
        if (!sandboxIdInput) {
          process.stderr.write(`Usage: tsa sessions start <sandbox-id>\n`)
          process.exit(1)
        }

        const client = new ApiClient(auth)

        let orgId: string
        try {
          orgId = await resolveOrgId(
            client,
            params.org as string | undefined,
            config?.org
          )
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
            sandboxIdInput,
            config?.sandbox
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }

        if (config) saveContext(config, orgId, projectId, sandboxId)

        try {
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
      options: {
        sandbox: {
          example: `--sb sb_xxx`,
          description: `Sandbox ID (auto-resolved if omitted)`,
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
      },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const sessionId = options?.[0] as string | undefined
        if (!sessionId) {
          process.stderr.write(`Usage: tsa sessions connect <session-id>\n`)
          process.exit(1)
        }

        const client = new ApiClient(auth)

        let orgId: string
        try {
          orgId = await resolveOrgId(
            client,
            params.org as string | undefined,
            config?.org
          )
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

        let sandboxId = params.sandbox as string | undefined
        if (!sandboxId) {
          const result = await resolveSessionSandbox(client, orgId, projectId, sessionId)
          if (!result) {
            process.stderr.write(
              `${themed(`error`, `Error:`)} Could not find session ${sessionId} in any sandbox\n`
            )
            process.exit(1)
          }
          sandboxId = result.sandboxId
        }

        if (config) saveContext(config, orgId, projectId, sandboxId)

        try {
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
      },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const explicitSessionId = options?.[0] as string | undefined
        const client = new ApiClient(auth)

        let orgId: string
        try {
          orgId = await resolveOrgId(
            client,
            params.org as string | undefined,
            config?.org
          )
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
            params.sandbox as string | undefined,
            config?.sandbox
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }

        if (config) saveContext(config, orgId, projectId, sandboxId)

        let sessionId: string
        try {
          sessionId = await resolveSessionId(
            client,
            orgId,
            projectId,
            sandboxId,
            explicitSessionId
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }

        try {
          const creds = auth.creds()
          await changeVisibility(client, orgId, projectId, sessionId, `public`, creds)
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
      },
      action: ensureAuth(async ({ params, auth, config, options }) => {
        const explicitSessionId = options?.[0] as string | undefined
        const client = new ApiClient(auth)

        let orgId: string
        try {
          orgId = await resolveOrgId(
            client,
            params.org as string | undefined,
            config?.org
          )
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
            params.sandbox as string | undefined,
            config?.sandbox
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }

        if (config) saveContext(config, orgId, projectId, sandboxId)

        let sessionId: string
        try {
          sessionId = await resolveSessionId(
            client,
            orgId,
            projectId,
            sandboxId,
            explicitSessionId
          )
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }

        try {
          const creds = auth.creds()
          await changeVisibility(client, orgId, projectId, sessionId, `private`, creds)
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
