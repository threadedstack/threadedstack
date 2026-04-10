import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { spawnSsh } from '@TSA/utils/tasks/spawnSsh'
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { sandboxConnect } from '@TSA/utils/tasks/sandboxConnect'
import { autoStartSync, createSyncContext, stopSync } from '@TSA/utils/tasks/sandboxSync'

export const ssh: TTask = {
  name: `ssh`,
  alias: [],
  description: `Connect to a running sandbox via SSH`,
  example: `tsa ssh <sandbox-id> [--org <id>]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID`,
      alias: [`sandboxId`, `sb`],
    },
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
  },
  action: requireAuth(async ({ params, auth, config, options }) => {
    const sandboxId = params.sandbox || options?.[0]
    if (!sandboxId) {
      process.stdout.write(
        `${themed(`warning`, `Usage: tsa ssh <sandbox-id> [--org <id>]`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    try {
      await sandboxConnect(client, orgId, sandboxId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const syncCtx = createSyncContext()
    try {
      await autoStartSync(syncCtx, config?.sync, client, orgId, sandboxId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      await stopSync(syncCtx, sandboxId)
      process.exit(1)
    }

    try {
      await spawnSsh(sandboxId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      await stopSync(syncCtx, sandboxId)
    }
  }),
}
