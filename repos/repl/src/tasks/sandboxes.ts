import type { TTask } from '@TRL/types'

import { themed } from '@TRL/theme'
import { ApiClient } from '@TRL/services/api'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const sandboxes: TTask = {
  name: `sandboxes`,
  alias: [`sandbox`, `sb`],
  description: `List sandbox configurations`,
  example: `tsa sandboxes [--org <id>]`,
  options: {
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
  },
  action: requireAuth(async ({ params, auth }) => {
    const client = new ApiClient(auth)

    try {
      let orgId = params.org as string | undefined
      if (!orgId) {
        const orgs = await client.listOrgs()
        if (orgs.length === 1) {
          orgId = orgs[0].id
        } else {
          process.stdout.write(`\n${themed(`bold`, `Organizations:`)}\n`)
          for (const org of orgs) {
            process.stdout.write(`  ${themed(`muted`, org.id)} ${org.name}\n`)
          }
          process.stdout.write(
            `\n${themed(`muted`, `Use --org <id> to list sandboxes for a specific org`)}\n\n`
          )
          return
        }
      }

      const list = await client.listSandboxes(orgId)

      if (!list.length) {
        process.stdout.write(`${themed(`muted`, `No sandboxes found`)}\n`)
        return
      }

      process.stdout.write(`\n${themed(`bold`, `Sandboxes:`)}\n`)
      const nameW = 20
      const imageW = 30
      process.stdout.write(`  ${'Name'.padEnd(nameW)} ${'Image'.padEnd(imageW)} ID\n`)
      process.stdout.write(
        `  ${`─`.repeat(nameW)} ${`─`.repeat(imageW)} ${'─'.repeat(12)}\n`
      )
      for (const sb of list) {
        const name = (sb.name || `unnamed`).slice(0, nameW).padEnd(nameW)
        const image = (sb.config?.image || `-`).slice(0, imageW).padEnd(imageW)
        process.stdout.write(
          `  ${name} ${themed(`muted`, image)} ${themed(`muted`, sb.id)}\n`
        )
      }
      process.stdout.write(`\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to list sandboxes`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }
  }),
}
