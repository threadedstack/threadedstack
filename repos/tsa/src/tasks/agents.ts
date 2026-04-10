import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { requireAuth } from '@TSA/utils/tasks/requireAuth'

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

    let orgId = params.org as string | undefined

    if (!orgId) {
      const { data: orgs, error } = await client.listOrgs()
      if (error || !orgs) {
        const msg = error?.message || `Failed to list organizations`
        process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
        process.exit(1)
      }

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

    const { data: agentList, error } = await client.listAgents(orgId)
    if (error || !agentList) {
      const msg = error?.message || `Failed to list agents`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    if (!agentList.length) {
      process.stdout.write(`${themed(`muted`, `No agents found`)}\n`)
      return
    }

    process.stdout.write(`\n${themed(`bold`, `Agents:`)}\n`)
    for (const agent of agentList) {
      const model = agent.model ? themed(`muted`, ` (${agent.model})`) : ``
      process.stdout.write(`  ${themed(`muted`, agent.id)} ${agent.name}${model}\n`)
    }
    process.stdout.write(`\n`)
  }),
}
