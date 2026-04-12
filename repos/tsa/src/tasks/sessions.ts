import type { TTask } from '@TSA/types'
import type { TSandboxSession } from '@tdsk/domain'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'

const resolveSessionSandbox = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sessionId: string
): Promise<{ sandboxId: string; session: TSandboxSession } | undefined> => {
  const { data: sandboxes } = await client.listSandboxes(orgId, projectId)
  if (!sandboxes) return undefined

  for (const sb of sandboxes) {
    const { data: sessions } = await client.getSandboxSessions(orgId, projectId, sb.id)
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
  visibility: `public` | `private`
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

  const proxyUrl = client.proxyUrl.replace(/^http/, `ws`)
  const wsUrl = `${proxyUrl}/_/sandboxes/${resolved.sandboxId}/shell?sessionId=${sessionId}&token=${connectData.shellToken}`

  const ws = new WebSocket(wsUrl)

  await new Promise<void>((resolve, reject) => {
    let confirmed = false

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error(`Timed out waiting for visibility confirmation`))
    }, 10_000)

    ws.addEventListener(`open`, () => {
      ws.send(JSON.stringify({ type: `visibility`, visibility }))
    })

    ws.addEventListener(`message`, (event) => {
      try {
        const msg = JSON.parse(String(event.data))
        if (msg.type === `visibility`) {
          confirmed = true
          clearTimeout(timeout)
          process.stdout.write(
            `${themed(`success`, `Done:`)} Session ${sessionId.slice(0, 12)} is now ${themed(`bold`, visibility)}\n`
          )
          ws.close()
          resolve()
        } else if (msg.type === `error`) {
          clearTimeout(timeout)
          ws.close()
          reject(new Error(msg.message || `Server error`))
        }
      } catch {
        // Non-JSON message, ignore
      }
    })

    ws.addEventListener(`error`, () => {
      clearTimeout(timeout)
      reject(new Error(`WebSocket connection failed`))
    })

    ws.addEventListener(`close`, (event) => {
      clearTimeout(timeout)
      if (!confirmed) {
        reject(
          new Error(event.reason || `Connection closed before visibility was confirmed`)
        )
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
    share: {
      name: `share`,
      description: `Make a session public (shareable with project members)`,
      example: `tsa sessions share <session-id> [--org <id>] [--project <id>]`,
      options: {
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
      action: requireAuth(async ({ params, auth, config, options }) => {
        const sessionId = options?.[0]
        if (!sessionId) {
          process.stderr.write(
            `${themed(`warning`, `Usage: tsa sessions share <session-id>`)}\n`
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

        try {
          await changeVisibility(client, orgId, projectId, sessionId, `public`)
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }
      }),
    },
    unshare: {
      name: `unshare`,
      description: `Make a session private`,
      example: `tsa sessions unshare <session-id> [--org <id>] [--project <id>]`,
      options: {
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
      action: requireAuth(async ({ params, auth, config, options }) => {
        const sessionId = options?.[0]
        if (!sessionId) {
          process.stderr.write(
            `${themed(`warning`, `Usage: tsa sessions unshare <session-id>`)}\n`
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

        try {
          await changeVisibility(client, orgId, projectId, sessionId, `private`)
        } catch (err) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
          process.exit(1)
        }
      }),
    },
  },
  action: requireAuth(async ({ params, auth, config, options }) => {
    const sandboxId = params.sandbox || options?.[0]
    if (!sandboxId) {
      process.stderr.write(
        `${themed(`warning`, `Usage: tsa sessions <sandbox-id> [--org <id>]`)}\n`
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
}
