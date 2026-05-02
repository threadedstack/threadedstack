import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { resolveSandboxId } from '@TSA/utils/tasks/resolveSandboxId'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { sandboxConnectPod } from '@TSA/utils/tasks/sandboxConnectPod'
import { connectShellWebSocket } from '@TSA/utils/tasks/shellWebSocket'
import { autoStartSync, createSyncContext, stopSync } from '@TSA/utils/tasks/sandboxSync'
import {
  clearSyncCleanup,
  registerSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'

const getAlias = (sandbox: any, projectId: string): string =>
  sandbox.projectConfigs?.find((pc: any) => pc.projectId === projectId)?.alias || ``

export const sandbox: TTask = {
  name: `sandbox`,
  alias: [`sb`, `run`],
  description: `Start a sandbox, sync files, and launch its configured AI tool`,
  example: `tsa sandbox [<sandbox>] [--org <id>] [--project <id>] [--no-sync]`,
  options: {
    sandbox: {
      example: `--sb sb_xxx`,
      description: `Sandbox ID or alias`,
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
    new: {
      alias: [`n`],
      type: `bool`,
      description: `Skip session discovery and always create a new session`,
    },
    list: {
      example: `--list`,
      description: `List available sandboxes and exit`,
      alias: [`ls`],
      type: `bool`,
    },
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const explicitSandboxId = params.sandbox || options?.[0]
    const client = new ApiClient(auth)

    let orgId: string
    try {
      orgId = await resolveOrgId(client, params.org as string | undefined, config?.org)
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

    // List sandboxes when --list flag is set
    if (params.list) {
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
      return
    }

    // Resolve sandbox ID — interactive picker if no explicit ID provided
    let sandboxId: string
    try {
      sandboxId = await resolveSandboxId(
        client,
        orgId,
        projectId,
        explicitSandboxId as string | undefined,
        config?.sandbox
      )
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    // Fetch sandbox config to get runtimeCommand — hard error if this fails
    const { data: sandboxData, error: sandboxError } = await client.getSandbox(
      orgId,
      sandboxId,
      projectId
    )
    if (sandboxError || !sandboxData) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} Could not fetch sandbox config: ${sandboxError?.message || `sandbox not found`}\n` +
          `${themed(`muted`, `Cannot determine runtime command. Use "tsa ssh" for a plain shell.`)}\n`
      )
      process.exit(1)
    }

    const runtimeCommand = sandboxData.config?.runtimeCommand as string | undefined

    let resolvedId: string | undefined
    let shellToken: string | undefined
    try {
      const connectResp = await sandboxConnectPod(client, orgId, projectId, sandboxId)
      if (!connectResp.sandboxId)
        throw new Error(`Server did not return a resolved sandbox ID`)
      resolvedId = connectResp.sandboxId
      shellToken = connectResp.shellToken
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    // Persist sandbox only after confirmed successful connection
    if (config) saveContext(config, orgId, projectId, resolvedId)

    const creds = auth.creds()
    const bearerToken = creds?.apiKey || shellToken || creds?.token
    if (!bearerToken) {
      process.stderr.write(
        `${themed(`error`, `Error:`)} No authentication credentials available.\n` +
          `${themed(`muted`, `Run "tsa login <api-key>" to authenticate.`)}\n`
      )
      process.exit(1)
    }

    let targetSessionId: string | undefined
    const forceNew = params.new as boolean | undefined

    if (!forceNew && process.stdin.isTTY) {
      try {
        const { data: sessions } = await client.getSandboxSessions(
          orgId,
          projectId,
          resolvedId!
        )
        const reconnectable = sessions?.filter((s) => s.hasShellSession) || []

        if (reconnectable.length > 0) {
          const readline = await import(`readline`)
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr,
          })

          const sessionLabel = reconnectable[0].sessionId.slice(0, 12)
          const answer = await new Promise<string>((resolve) => {
            rl.question(
              `${themed(`primary`, `Found ${reconnectable.length} existing session(s).`)} ` +
                `Reconnect to ${sessionLabel}? (Y/n/new) `,
              (ans: string) => {
                rl.close()
                resolve(ans.trim().toLowerCase())
              }
            )
          })

          if (answer === `` || answer === `y` || answer === `yes`) {
            targetSessionId = reconnectable[0].sessionId
            process.stderr.write(
              `${themed(`muted`, `Reconnecting to ${sessionLabel}... (ctrl+] to detach)`)}\n`
            )
          }
        }
      } catch (err) {
        const status = (err as any)?.status ?? (err as any)?.statusCode
        const msg = (err as Error).message
        const statusErr =
          status === 401 || status === 403 || msg.includes(`401`) || msg.includes(`403`)
        if (statusErr || msg.includes(`Not logged in`)) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${msg}\n`)
          process.exit(1)
        }
        if (status && status >= 500) {
          process.stderr.write(
            `${themed(`warning`, `Warning:`)} Session discovery failed: ${msg}\n`
          )
        } else {
          process.stderr.write(
            `${themed(`muted`, `Session discovery skipped: ${msg}`)}\n`
          )
        }
      }
    }

    const skipSync = params.noSync as boolean | undefined
    const syncCtx = createSyncContext()
    if (!skipSync) {
      try {
        await autoStartSync(syncCtx, config?.sync, client, orgId, resolvedId!)
        if (syncCtx.started) registerSyncCleanup(resolvedId!, syncCtx.manager)
      } catch (err) {
        process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
        try {
          await stopSync(syncCtx, resolvedId!)
        } catch (cleanupErr) {
          process.stderr.write(
            `${themed(`warning`, `Warning:`)} Sync cleanup failed: ${(cleanupErr as Error).message}\n`
          )
        }
        process.exit(1)
      }
    }

    if (runtimeCommand) {
      process.stdout.write(`${themed(`muted`, `Launching "${runtimeCommand}"...`)}\n`)
    }

    try {
      await connectShellWebSocket({
        bearerToken,
        sandboxId: resolvedId!,
        proxyUrl: client.proxyUrl,
        sessionId: targetSessionId,
        insecure: !!creds?.insecure,
        run: !targetSessionId && !!runtimeCommand,
      })
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      clearSyncCleanup()
      if (resolvedId) await stopSync(syncCtx, resolvedId)
    }
  }),
}
