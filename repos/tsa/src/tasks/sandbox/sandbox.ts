import type { TTask } from '@TSA/types'
import type { TSandboxConnectOpts } from '@tdsk/domain'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { listTask } from '@TSA/tasks/sandbox/list'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveSandboxId } from '@TSA/utils/tasks/resolveSandboxId'
import { resolveInstanceId } from '@TSA/utils/tasks/resolveInstanceId'
import { sandboxConnectPod } from '@TSA/utils/tasks/sandboxConnectPod'
import { connectShellWebSocket } from '@TSA/utils/tasks/shellWebSocket'
import { SandboxOptions, InstanceOptions } from '@TSA/constants/options'
import { autoStartSync, createSyncContext, stopSync } from '@TSA/utils/tasks/sandboxSync'
import {
  clearSyncCleanup,
  registerSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'

export const sandbox: TTask = {
  name: `sandbox`,
  alias: [`sb`, `run`, `sandboxes`],
  description: `Start a sandbox, sync files, and launch its configured AI tool`,
  example: `tsa sandbox [<sandbox>] [--org <id>] [--project <id>] [--instance <id>] [--new] [--no-sync]`,
  options: {
    ...SandboxOptions,
    ...InstanceOptions,
    noSync: {
      example: `--no-sync`,
      description: `Disable automatic file sync`,
      alias: [`nosync`],
      type: `bool`,
    },
  },
  tasks: {
    list: listTask,
  },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const explicitSandboxId = params.sandbox || options?.[0]
    const client = new ApiClient(auth)

    const base = await resolveContext({
      client,
      config,
      skipSandbox: true,
      explicitOrg: params.org as string | undefined,
      explicitProject: params.project as string | undefined,
    })
    const { orgId, projectId } = base

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
    const forceNew = params.new as boolean | undefined

    let instanceOpts: TSandboxConnectOpts | undefined
    try {
      instanceOpts = await resolveInstanceId(client, orgId, projectId, sandboxId, {
        explicitInstance: params.instance as string | undefined,
        forceNew,
      })
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    let resolvedId: string | undefined
    let resolvedInstanceId: string | undefined
    let shellToken: string | undefined
    try {
      const connectResp = await sandboxConnectPod(
        client,
        orgId,
        projectId,
        sandboxId,
        instanceOpts
      )
      if (!connectResp.sandboxId)
        throw new Error(`Server did not return a resolved sandbox ID`)
      resolvedId = connectResp.sandboxId
      resolvedInstanceId = connectResp.instanceId
      shellToken = connectResp.shellToken
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

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

    if (!forceNew && process.stdin.isTTY) {
      try {
        const { data: sessions } = await client.getSandboxSessions(
          orgId,
          projectId,
          resolvedId!
        )
        const reconnectable =
          sessions?.filter(
            (s) =>
              s.hasShellSession &&
              (!resolvedInstanceId || s.instanceId === resolvedInstanceId)
          ) || []

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
        await autoStartSync(
          syncCtx,
          config?.sync,
          client,
          orgId,
          resolvedId!,
          resolvedInstanceId
        )
        if (syncCtx.started)
          registerSyncCleanup(resolvedId!, syncCtx.manager, resolvedInstanceId)
      } catch (err) {
        process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
        try {
          await stopSync(syncCtx, resolvedId!, resolvedInstanceId)
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
        instanceId: resolvedInstanceId,
        run: !targetSessionId && !!runtimeCommand,
      })
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    } finally {
      clearSyncCleanup()
      if (resolvedId) await stopSync(syncCtx, resolvedId, resolvedInstanceId)
    }
  }),
}
