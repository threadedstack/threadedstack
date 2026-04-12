import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { spawnSsh } from '@TSA/utils/tasks/spawnSsh'
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { sandboxConnect } from '@TSA/utils/tasks/sandboxConnect'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { autoStartSync, createSyncContext, stopSync } from '@TSA/utils/tasks/sandboxSync'

export const run: TTask = {
  name: `run`,
  alias: [],
  description: `Start a sandbox, sync files, and launch its configured AI tool`,
  example: `tsa run <sandbox-id> [--org <id>] [--no-sync]`,
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
    project: {
      example: `--project proj_xxx`,
      description: `Project ID`,
      alias: [`projectId`, `p`],
    },
    noSync: {
      example: `--no-sync`,
      description: `Disable automatic file sync`,
      alias: [`nosync`],
      type: `bool`,
    },
    list: {
      example: `--list`,
      description: `List available sandboxes and exit`,
      alias: [`ls`],
      type: `bool`,
    },
  },
  action: requireAuth(async ({ params, auth, config, options }) => {
    const sandboxId = params.sandbox || options?.[0]
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    // If the org changed from the saved config, clear the cached project to force re-selection
    const explicitProject =
      orgId !== config?.org ? undefined : (params.project as string | undefined)

    let projectId: string
    try {
      projectId = await resolveProjectId(client, orgId, explicitProject)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    if (config) saveContext(config, orgId, projectId)

    // List sandboxes when --list flag is set or no sandbox ID provided
    if (params.list || !sandboxId) {
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
      const runtimeW = 20
      process.stdout.write(`  ${'Name'.padEnd(nameW)} ${'Runtime'.padEnd(runtimeW)} ID\n`)
      process.stdout.write(
        `  ${`─`.repeat(nameW)} ${`─`.repeat(runtimeW)} ${'─'.repeat(12)}\n`
      )
      for (const sb of list) {
        const name = (sb.name || `unnamed`).slice(0, nameW).padEnd(nameW)
        const runtime = (sb.config?.runtimeCommand || `-`)
          .slice(0, runtimeW)
          .padEnd(runtimeW)
        process.stdout.write(
          `  ${name} ${themed(`muted`, runtime)} ${themed(`muted`, sb.id)}\n`
        )
      }
      process.stdout.write(`\n`)

      if (!params.list) {
        process.stdout.write(
          `${themed(`warning`, `Usage: tsa run <sandbox-id> [--org <id>]`)}\n`
        )
        process.exit(1)
      }

      return
    }

    // Fetch sandbox config to get runtimeCommand — hard error if this fails
    const { data: sandbox, error: sandboxError } = await client.getSandbox(
      orgId,
      sandboxId
    )
    if (sandboxError || !sandbox) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} Could not fetch sandbox config: ${sandboxError?.message || `sandbox not found`}\n` +
          `${themed(`muted`, `Cannot determine runtime command. Use "tsa ssh" for a plain shell.`)}\n`
      )
      process.exit(1)
    }

    const runtimeCommand = sandbox.config?.runtimeCommand as string | undefined

    try {
      await sandboxConnect(client, orgId, projectId, sandboxId)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    const skipSync = params.noSync as boolean | undefined
    const syncCtx = createSyncContext()
    if (!skipSync) {
      try {
        await autoStartSync(syncCtx, config?.sync, client, orgId, sandboxId)
      } catch (err) {
        process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
        await stopSync(syncCtx, sandboxId)
        process.exit(1)
      }
    }

    if (runtimeCommand) {
      process.stdout.write(`${themed(`muted`, `Launching "${runtimeCommand}"...`)}\n`)
    }

    try {
      await spawnSsh(sandboxId, runtimeCommand)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      await stopSync(syncCtx, sandboxId)
    }
  }),
}
