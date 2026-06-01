import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { SandboxOptions } from '@TSA/constants/options'
import { getAlias } from '@TSA/utils/sandbox/getAlias'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'

export const listTask: TTask = {
  name: `list`,
  alias: [`ls`],
  options: { ...SandboxOptions },
  description: `List available sandboxes`,
  example: `tsa sandbox list [--org <id>] [--project <id>]`,
  action: ensureAuth(async ({ params, auth, config }) => {
    const client = new ApiClient(auth)
    const base = await resolveContext({
      client,
      config,
      skipSandbox: true,
      explicitOrg: params.org as string | undefined,
      explicitProject: params.project as string | undefined,
    })
    const { orgId, projectId } = base

    const { data: list, error } = await client.listSandboxes(orgId, projectId)
    if (error || !list) {
      const msg = error?.message || `Failed to list sandboxes`
      process.stderr.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    if (!list.length) {
      process.stdout.write(`${themed(`muted`, `No sandboxes found`)}\n`)
      return
    }

    process.stdout.write(`\n${themed(`bold`, `Sandboxes:`)}\n`)
    const nameW = 20
    const aliasW = 22
    const runtimeW = 20
    process.stdout.write(
      `  ${'Name'.padEnd(nameW)} ${'Alias'.padEnd(aliasW)} ${'Runtime'.padEnd(runtimeW)} ID\n`
    )
    process.stdout.write(
      `  ${`─`.repeat(nameW)} ${`─`.repeat(aliasW)} ${`─`.repeat(runtimeW)} ${'─'.repeat(12)}\n`
    )
    for (const sb of list) {
      const name = (sb.name || `unnamed`).slice(0, nameW).padEnd(nameW)
      const alias = (getAlias(sb, projectId) || `-`).slice(0, aliasW).padEnd(aliasW)
      const runtime = (sb.config?.runtimeCommand || `-`)
        .slice(0, runtimeW)
        .padEnd(runtimeW)
      process.stdout.write(
        `  ${name} ${themed(`success`, alias)} ${themed(`muted`, runtime)} ${themed(`muted`, sb.id)}\n`
      )
    }
    process.stdout.write(`\n`)

    if (config) saveContext(config, orgId, projectId)
  }),
}
