import type { TTask } from '@TRL/types'

import { ApiClient } from '@TRL/api'
import { bold, dim, red } from '@TRL/display/colors'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const agents: TTask = {
  name: `agents`,
  alias: [`ag`],
  description: `List available agents`,
  example: `tdsk-agent agents [--org <id>]`,
  options: {
    org: {
      description: `Organization ID`,
      example: `--org org_xxx`,
      type: `str`,
    },
  },
  action: requireAuth(async ({ params, auth, renderer }) => {
    const client = new ApiClient(auth)

    try {
      let orgId = params.org as string | undefined
      if (!orgId) {
        const orgs = (await client.listOrgs()) as { id: string; name: string }[]
        if (orgs.length === 1) {
          orgId = orgs[0].id
        } else {
          process.stdout.write(`\n${bold(`Organizations:`)}\n`)
          for (const org of orgs) {
            process.stdout.write(`  ${dim(org.id)} ${org.name}\n`)
          }
          process.stdout.write(
            `\n${dim(`Use --org <id> to list agents for a specific org`)}\n\n`
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
        renderer.renderInfo(`No agents found`)
        return
      }

      process.stdout.write(`\n${bold(`Agents:`)}\n`)
      for (const agent of agents) {
        const model = agent.model ? dim(` (${agent.model})`) : ``
        process.stdout.write(`  ${dim(agent.id)} ${agent.name}${model}\n`)
      }
      process.stdout.write(`\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list agents`
      process.stdout.write(`${red(bold(`Error:`))} ${msg}\n`)
      process.exit(1)
    }
  }),
}
