import type { TTask } from '@TSA/types'
import type { TSyncMode, TSyncRule } from '@tdsk/domain'

import { existsSync } from 'fs'
import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { requireAuth } from '@TSA/utils/tasks/requireAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { CliDriver } from '@TSA/services/sync/mutagenClient'
import { SyncManager } from '@TSA/services/sync/syncManager'
import { resolveProjectId } from '@TSA/utils/tasks/resolveProjectId'
import { ensureSshConfig, getPublicKey } from '@TSA/services/sync/sshConfig'
import { mergeRules, resolveSourcePath } from '@TSA/services/sync/configLoader'
import {
  registerSyncCleanup,
  clearSyncCleanup,
} from '@TSA/utils/tasks/syncCleanupRegistry'

const driver = new CliDriver()
const manager = new SyncManager(driver)

const stopTask: TTask = {
  name: `stop`,
  description: `Stop file sync sessions`,
  example: `tsa sync stop <sandbox-id>`,
  options: {
    all: {
      type: `bool`,
      description: `Stop all sync sessions`,
      alias: [`a`],
    },
  },
  action: requireAuth(async ({ params, auth, options }) => {
    if (params.all) {
      const sessions = await manager.status()
      const errors: string[] = []
      for (const s of sessions) {
        try {
          await driver.terminateSession(s.id)
        } catch (err) {
          errors.push(`${s.name || s.id}: ${(err as Error).message}`)
        }
      }
      if (errors.length) {
        process.stderr.write(
          `${themed(`warning`, `Warning: could not stop ${errors.length} session(s):`)} ${errors.join(`; `)}\n`
        )
      }
      process.stdout.write(`${themed(`success`, `All sync sessions stopped`)}\n`)
      return
    }

    const sandboxId = (options?.[0] || params.sandbox) as string
    if (!sandboxId) {
      process.stdout.write(
        `${themed(`error`, `Usage: tsa sync stop <sandbox-id> or --all`)}\n`
      )
      process.exit(1)
    }

    await manager.stopAll(sandboxId)
    process.stdout.write(`${themed(`success`, `Sync stopped for ${sandboxId}`)}\n`)
  }),
}

const statusTask: TTask = {
  name: `status`,
  description: `Show sync session status`,
  example: `tsa sync status [sandbox-id]`,
  action: requireAuth(async ({ options }) => {
    const sandboxId = options?.[0] as string | undefined
    const sessions = await manager.status(sandboxId)

    if (sessions.length === 0) {
      process.stdout.write(`${themed(`muted`, `No active sync sessions`)}\n`)
      return
    }

    // Group by sandboxId
    const grouped = new Map<string, typeof sessions>()
    for (const s of sessions) {
      const key = s.labels?.sandboxId || 'unknown'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(s)
    }

    for (const [sbId, group] of grouped) {
      process.stdout.write(`\n${themed(`bold`, `Sandbox: ${sbId}`)}\n`)
      for (const s of group) {
        const icon = s.status === 'errored' || s.status === 'disconnected' ? '!' : '*'
        const color =
          s.status === 'errored' || s.status === 'disconnected' ? 'warning' : 'success'
        const src = s.source || '?'
        const tgt = s.target || '?'
        const mode = s.mode || '?'
        process.stdout.write(
          `  ${s.name.padEnd(16)} ${src} -> ${tgt}  ${mode.padEnd(18)} ${themed(color as any, `${icon} ${s.status}`)}\n`
        )
      }
    }
    process.stdout.write(`\n`)
  }),
}

const flushTask: TTask = {
  name: `flush`,
  description: `Force immediate sync cycle`,
  example: `tsa sync flush <sandbox-id>`,
  action: requireAuth(async ({ options, params }) => {
    const sandboxId = (options?.[0] || params.sandbox) as string
    if (!sandboxId) {
      process.stdout.write(`${themed(`error`, `Usage: tsa sync flush <sandbox-id>`)}\n`)
      process.exit(1)
    }
    await manager.flushAll(sandboxId)
    process.stdout.write(`${themed(`success`, `Flush triggered for ${sandboxId}`)}\n`)
  }),
}

const cleanupTask: TTask = {
  name: `cleanup`,
  description: `Terminate orphaned sync sessions (errored/disconnected)`,
  example: `tsa sync cleanup`,
  action: requireAuth(async () => {
    const sessions = await manager.status()
    const orphaned = sessions.filter(
      (s) => s.status === `errored` || s.status === `disconnected`
    )

    if (orphaned.length === 0) {
      process.stdout.write(`${themed(`muted`, `No orphaned sessions found`)}\n`)
      return
    }

    process.stdout.write(
      `${themed(`muted`, `Found ${orphaned.length} orphaned session${orphaned.length !== 1 ? `s` : ``}`)}\n`
    )

    const errors: string[] = []
    for (const s of orphaned) {
      const sbId = s.labels?.sandboxId || `unknown`
      process.stdout.write(
        `  ${themed(`muted`, s.name)} (${sbId}) — ${themed(`warning`, s.status)}\n`
      )
      try {
        await driver.terminateSession(s.id)
      } catch (err) {
        errors.push(`${s.name || s.id}: ${(err as Error).message}`)
      }
    }

    if (errors.length) {
      process.stderr.write(
        `${themed(`warning`, `Warning: could not terminate ${errors.length} session(s):`)} ${errors.join(`; `)}\n`
      )
    }
    process.stdout.write(
      `${themed(`success`, `Cleaned up ${orphaned.length - errors.length} session${orphaned.length - errors.length !== 1 ? `s` : ``}`)}\n`
    )
  }),
}

export const sync: TTask = {
  name: `sync`,
  alias: [`sy`],
  description: `Sync files with a K8s sandbox`,
  example: `tsa sync <sandbox-id> [--source ./src] [--target /workspace/src]`,
  tasks: {
    stop: stopTask,
    status: statusTask,
    flush: flushTask,
    cleanup: cleanupTask,
  },
  options: {
    daemon: {
      type: `bool`,
      description: `Run sync in background`,
      alias: [`d`],
      default: false,
    },
    org: {
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`, `o`],
    },
    sandbox: {
      description: `Sandbox ID`,
      alias: [`sandboxId`, `sb`],
    },
    project: {
      description: `Project ID`,
      alias: [`projectId`, `p`],
    },
    source: {
      description: `Local source path (single-rule shorthand)`,
      alias: [`s`, `src`],
    },
    target: {
      description: `Remote target path`,
      alias: [`t`, `tgt`],
      default: `/workspace`,
    },
    mode: {
      description: `Sync mode`,
      alias: [`m`],
      allowed: [`one-way-replica`, `one-way-safe`, `two-way-safe`, `two-way-resolved`],
      default: `one-way-replica`,
    },
    ignore: {
      description: `Ignore patterns (repeatable)`,
      alias: [`i`],
      type: `arr`,
    },
    noDefaults: {
      type: `bool`,
      description: `Skip default ignore patterns`,
      default: false,
    },
    name: {
      description: `Session name`,
      alias: [`n`],
    },
  },
  action: requireAuth(async ({ params, auth, config, options }) => {
    const sandboxId = (params.sandbox || options?.[0]) as string
    if (!sandboxId) {
      process.stdout.write(
        `${themed(`error`, `Usage: tsa sync <sandbox-id> [options]`)}\n` +
          `${themed(`muted`, `  Or configure rules in ~/.config/tdsk/tsa.yaml under sync.rules`)}\n`
      )
      process.exit(1)
    }

    const client = new ApiClient(auth)

    // Resolve org
    let orgId = params.org as string | undefined
    if (!orgId) {
      const { data: orgs, error } = await client.listOrgs()
      if (error || !orgs) {
        const msg = error?.message || `Failed to list organizations`
        process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
        process.exit(1)
      }
      if (orgs.length === 1) orgId = orgs[0].id
      else {
        process.stdout.write(
          `${themed(`error`, `Multiple orgs found. Use --org to specify.`)}\n`
        )
        process.exit(1)
      }
    }

    // Resolve project — clear cached project when org changes
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

    // Auto-start pod via connect
    process.stdout.write(`${themed(`muted`, `Connecting to sandbox...`)}\n`)
    const { data: connectResp, error: connectError } = await client.connectSandbox(
      orgId as string,
      projectId,
      sandboxId
    )
    if (connectError || !connectResp) {
      const msg = connectError?.message || `Failed to connect`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }
    const { podName } = connectResp
    if (!podName) {
      process.stdout.write(
        `${themed(`error`, `Error: No pod name returned from server`)}\n`
      )
      process.exit(1)
    }

    // Inject SSH public key into pod for key-based auth
    ensureSshConfig()
    const publicKey = getPublicKey()
    const { error: sshError } = await client.injectSshKey(
      orgId,
      projectId,
      sandboxId,
      podName,
      publicKey
    )
    if (sshError) {
      process.stdout.write(`${themed(`error`, `Error:`)} ${sshError.message}\n`)
      process.exit(1)
    }

    // Fetch sandbox for sync config defaults
    const { data: sandbox, error: sandboxError } = await client.getSandbox(
      orgId as string,
      sandboxId
    )
    if (sandboxError) {
      process.stdout.write(
        `${themed('error', 'Error:')} Failed to fetch sandbox config: ${sandboxError.message}\n`
      )
      process.exit(1)
    }
    const sandboxSync = sandbox?.config?.sync

    // Resolve rules: CLI shorthand or config file
    let rules: TSyncRule[]
    const syncConfig = config?.sync

    if (params.source) {
      // Single-rule shorthand from CLI flags
      rules = [
        {
          name: (params.name as string) || `cli-sync`,
          source: params.source as string,
          target: (params.target as string) || `/workspace`,
          mode: (params.mode as TSyncMode) || `one-way-replica`,
          ignores: (params.ignore as string[]) || [],
        },
      ]
    } else if (syncConfig?.rules?.length) {
      // Get per-sandbox overrides if they exist
      const overrides = syncConfig.sandboxes?.[sandboxId]?.rules
      rules = mergeRules(syncConfig.rules, sandboxSync, overrides)
    } else {
      process.stdout.write(
        `${themed(`error`, `No sync rules configured.`)}\n` +
          `${themed(`muted`, `  Add rules to ~/.config/tdsk/tsa.yaml under sync.rules`)}\n` +
          `${themed(`muted`, `  Or use --source <path> for a quick one-off sync`)}\n`
      )
      process.exit(1)
    }

    // Resolve and validate source paths
    const cwd = process.cwd()
    for (const rule of rules) {
      rule.source = resolveSourcePath(rule.source, cwd)
      if (!existsSync(rule.source)) {
        process.stdout.write(
          `${themed(`error`, `Source path does not exist: ${rule.source}`)}\n`
        )
        process.exit(1)
      }
    }

    // Start sync
    const sessions = await manager.startAll(
      sandboxId,
      orgId,
      rules,
      sandboxSync,
      syncConfig?.defaultIgnores,
      params.noDefaults as boolean
    )

    if (sessions.length === 0) {
      process.stdout.write(
        `${themed(`muted`, `All sync rules already have active sessions. Use "tsa sync status" to check.`)}\n`
      )
    } else {
      const total = sessions.length
      process.stdout.write(
        `${themed(`success`, `File sync started (${total} rule${total !== 1 ? 's' : ''})`)}\n`
      )
    }

    if (params.daemon) {
      // Daemon mode: print and exit, sessions persist via Mutagen daemon
      for (const s of sessions) {
        process.stdout.write(
          `  ${themed(`muted`, s.name)} ${s.source || `?`} -> ${s.target || `?`}\n`
        )
      }
      process.stdout.write(
        `\n${themed(`muted`, `File sync running in background. Use "tsa sync stop ${sandboxId}" to stop.`)}\n`
      )
      return
    }

    // Foreground mode: block until Ctrl+C
    process.stdout.write(`${themed(`muted`, `Press Ctrl+C to stop sync`)}\n\n`)

    // Register for global signal handler fallback
    registerSyncCleanup(sandboxId, manager)

    let cleanupRunning = false
    const cleanup = async () => {
      if (cleanupRunning) {
        process.stderr.write(`\nForce quitting...\n`)
        process.exit(1)
      }
      cleanupRunning = true
      clearSyncCleanup()
      process.stdout.write(`\n${themed(`muted`, `Stopping sync...`)}\n`)
      const timer = setTimeout(() => {
        process.stderr.write(
          `Cleanup timed out. Sessions may still be running. Use "tsa sync stop ${sandboxId}" to clean up.\n`
        )
        process.exit(1)
      }, 10_000)
      try {
        await manager.stopAll(sandboxId)
        clearTimeout(timer)
        process.stdout.write(`${themed(`success`, `File sync stopped`)}\n`)
      } catch (err) {
        clearTimeout(timer)
        process.stderr.write(
          `Warning: could not stop all sync sessions: ${(err as Error).message}\n` +
            `Run "tsa sync stop ${sandboxId}" to clean up manually.\n`
        )
      }
      process.exit(0)
    }

    process.on(`SIGINT`, cleanup)
    process.on(`SIGTERM`, cleanup)

    // Keep process alive
    await new Promise(() => {})
  }),
}
