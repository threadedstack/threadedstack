import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/api'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const agents: TTask = {
  name: `agents`,
  alias: [`agent`, `ag`],
  description: `List available agents`,
  example: `tsa agents [--org <id>]`,
  options: {
    org: {
      type: `str`,
      example: `--org org_xxx`,
      description: `Organization ID`,
    },
  },
  action: requireAuth(async ({ params, auth }) => {
    const client = new ApiClient(auth)

    try {
      let orgId = params.org as string | undefined

      if (!orgId) {
        const orgs = (await client.listOrgs()) as { id: string; name: string }[]

        if (orgs.length === 1) {
          orgId = orgs[0].id
        } else {
          process.stdout.write(`\n${themed(`bold`, `Organizations:`)}\n`)
          for (const org of orgs) {
            process.stdout.write(`  ${themed(`muted`, org.id)} ${org.name}\n`)
          }
          process.stdout.write(
            `\n${themed(`muted`, `Use --org <id> to list agents for a specific org`)}\n\n`
          )
          return
        }
      }

      const agents = (await client.listAgents(orgId)) as {
        id: string
        name: string
        model?: string
      }[]

      if (!agents.length) {
        process.stdout.write(`${themed(`muted`, `No agents found`)}\n`)
        return
      }

      process.stdout.write(`\n${themed(`bold`, `Agents:`)}\n`)
      for (const agent of agents) {
        const model = agent.model ? themed(`muted`, ` (${agent.model})`) : ``
        process.stdout.write(`  ${themed(`muted`, agent.id)} ${agent.name}${model}\n`)
      }
      process.stdout.write(`\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list agents`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }
  }),
}
