import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { SandboxOptions } from '@TSA/constants/options'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'

export const list: TTask = {
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

    const grouped = new Map<string, typeof list>()
    for (const s of list) {
      const key = s.instanceId || `unknown`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(s)
    }

    const idW = 16
    const ownerW = 20
    const visW = 10

    for (const [instId, sessions] of grouped) {
      if (grouped.size > 1) {
        process.stdout.write(`  ${themed(`primary`, `Instance:`)} ${instId.slice(-16)}\n`)
      }

      process.stdout.write(
        `  ${'ID'.padEnd(idW)} ${'Owner'.padEnd(ownerW)} ${'Visibility'.padEnd(visW)} Connected\n`
      )
      process.stdout.write(
        `  ${'─'.repeat(idW)} ${'─'.repeat(ownerW)} ${'─'.repeat(visW)} ${'─'.repeat(20)}\n`
      )

      for (const s of sessions) {
        const id = s.sessionId.slice(0, 14).padEnd(idW)
        const owner = s.userId.slice(0, 18).padEnd(ownerW)
        const vis = s.visibility.padEnd(visW)
        process.stdout.write(
          `  ${themed(`muted`, id)} ${owner} ${vis} ${themed(`muted`, s.connectedAt)}\n`
        )
      }
      process.stdout.write(`\n`)
    }
  }),
}
