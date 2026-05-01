import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { resolveAgentId } from '@TSA/utils/tasks/resolveAgentId'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'

export const threads: TTask = {
  name: `threads`,
  alias: [`th`],
  description: `List threads for an agent`,
  example: `tsa threads [<agent-id>] [--org <id>] [--project <id>]`,
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
    project: {
      example: `--project proj_xxx`,
      description: `Project ID`,
      alias: [`projectId`, `p`],
    },
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const explicitAgentId = params.agent || options?.[0]
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const orgChanged = orgId !== config?.org
    const explicitProject = orgChanged
      ? undefined
      : (params.project as string | undefined)

    let projectId: string
    try {
      projectId = await resolveProjectId(client, orgId, explicitProject)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    let agentId: string
    try {
      agentId = await resolveAgentId(
        client,
        orgId,
        explicitAgentId as string | undefined,
        orgChanged ? undefined : config?.agent
      )
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (config) saveContext(config, orgId, projectId, undefined, agentId)

    const { data: threadList, error: threadsError } = await client.listThreads(
      orgId,
      agentId
    )
    if (threadsError || !threadList) {
      const msg = threadsError?.message || `Failed to list threads`
      process.stderr.write(`${themed(`error`, `Error:`)} ${msg}\n`)
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
