import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/services/api'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const threads: TTask = {
  name: `threads`,
  alias: [`th`],
  description: `List threads for an agent`,
  example: `tsa threads <agent-id> [--org <id>]`,
  options: {
    agent: {
      alias: [`agentId`],
      example: `--agentId agent_xxx`,
      description: `Agent ID to list threads for`,
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
  },
  action: requireAuth(async ({ params, auth, options }) => {
    // TODO: Check if agent-id and org-id can be loaded from state instead
    const agentId = params.agent || options?.[0]
    if (!agentId) {
      process.stdout.write(
        `${themed(`warning`, `Usage: tsa threads <agent-id> [--org <id>]`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)

    let orgId = params.org as string | undefined
    if (!orgId) {
      const { data: orgs, error: orgsError } = await client.listOrgs()
      if (orgsError || !orgs) {
        const msg = orgsError?.message || `Failed to list organizations`
        process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
        process.exit(1)
      }
      if (orgs.length === 1) {
        orgId = orgs[0].id
      } else {
        process.stdout.write(
          `${themed(`warning`, `Multiple orgs found. Use --org <id> to specify.`)}\n`
        )
        process.exit(1)
      }
    }

    const { data: threadList, error: threadsError } = await client.listThreads(
      orgId,
      agentId
    )
    if (threadsError || !threadList) {
      const msg = threadsError?.message || `Failed to list threads`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    if (!threadList.length) {
      process.stdout.write(`${themed(`muted`, `No threads found`)}\n`)
      return
    }

    process.stdout.write(`\n${themed(`bold`, `Threads:`)}\n`)
    for (const t of threadList) {
      const name = t.name || themed(`muted`, `untitled`)
      process.stdout.write(`  ${themed(`muted`, t.id)} ${name}\n`)
    }
    process.stdout.write(`\n`)
  }),
}
