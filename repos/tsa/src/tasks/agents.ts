import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'

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
  action: ensureAuth(async ({ params, auth, config }) => {
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
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
