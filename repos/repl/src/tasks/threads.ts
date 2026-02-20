import type { TTask } from '@TRL/types'

import { ApiClient } from '@TRL/api'
import { themed } from '@TRL/theme'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const threads: TTask = {
  name: `threads`,
  alias: [`th`],
  description: `List threads for an agent`,
  example: `tsa threads <agent-id> [--org <id>]`,
  options: {
    agentId: {
      description: `Agent ID to list threads for`,
      example: `--agentId agent_xxx`,
      type: `str`,
    },
    org: {
      description: `Organization ID`,
      example: `--org org_xxx`,
      type: `str`,
    },
  },
  action: requireAuth(async ({ params, auth, options }) => {
    const agentId = params.agentId || options?.[0]
    if (!agentId) {
      process.stdout.write(
        `${themed('warning', `Usage: tsa threads <agent-id> [--org <id>]`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)

    try {
      let orgId = params.org as string | undefined
      if (!orgId) {
        const orgs = (await client.listOrgs()) as { id: string }[]
        if (orgs.length === 1) {
          orgId = orgs[0].id
        } else {
          process.stdout.write(
            `${themed('warning', `Multiple orgs found. Use --org <id> to specify.`)}\n`
          )
          process.exit(1)
        }
      }

      const threads = (await client.listThreads(orgId, agentId)) as {
        id: string
        name?: string
        createdAt?: string
      }[]

      if (!threads.length) {
        process.stdout.write(`${themed('muted', `No threads found`)}\n`)
        return
      }

      process.stdout.write(`\n${themed('bold', `Threads:`)}\n`)
      for (const t of threads) {
        const name = t.name || themed('muted', `untitled`)
        process.stdout.write(`  ${themed('muted', t.id)} ${name}\n`)
      }
      process.stdout.write(`\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list threads`
      process.stdout.write(`${themed('error', `Error:`)} ${msg}\n`)
      process.exit(1)
    }
  }),
}
