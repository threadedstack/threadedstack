import type { TTask } from '@TRL/types'

import { existsSync } from 'fs'
import { themed } from '@TRL/theme'
import { spawn } from 'child_process'
import { ApiClient } from '@TRL/services/api'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'
import { CliDriver } from '@TRL/services/sync/mutagenClient'
import { SyncManager } from '@TRL/services/sync/syncManager'
import { ensureSshConfig, getPublicKey } from '@TRL/services/sync/sshConfig'
import { mergeRules, resolveSourcePath } from '@TRL/services/sync/configLoader'

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
    let orgId = params.org as string | undefined

    if (!orgId) {
      const { data: orgs, error } = await client.listOrgs()
      if (error || !orgs) {
        const msg = error?.message || `Failed to list organizations`
        process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
        process.exit(1)
      }
      if (orgs.length === 1) {
        orgId = orgs[0].id
      } else {
        process.stdout.write(
          `${themed(`warning`, `Multiple orgs found. Use --org <id> to specify.`)}\n`
        )
        process.exit(1)
      }
    }

    process.stdout.write(
      `${themed(`muted`, `Connecting to sandbox "${sandboxId}"...`)}\n`
    )

    const { data: connectResp, error } = await client.connectSandbox(orgId, sandboxId)
    if (error || !connectResp) {
      const msg = error?.message || `Failed to connect`
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

    // Ensure SSH key pair exists and inject public key into pod
    ensureSshConfig()
    const publicKey = getPublicKey()
    const { error: sshError } = await client.injectSshKey(
      orgId,
      sandboxId,
      podName,
      publicKey
    )
    if (sshError) {
      process.stdout.write(`${themed(`error`, `Error:`)} ${sshError.message}\n`)
      process.exit(1)
    }

    process.stdout.write(`${themed(`muted`, `SSH session ready.`)}\n`)

    // Auto-start sync if configured (best-effort — sync failure should not block SSH)
    let syncStarted = false
    const syncConfig = config?.sync
    const syncDriver = new CliDriver()
    const syncManager = new SyncManager(syncDriver)

    if (syncConfig?.autoStart && syncConfig?.rules?.length) {
      try {
        const { data: sandbox, error: sandboxError } = await client.getSandbox(
          orgId,
          sandboxId
        )
        if (sandboxError) {
          process.stderr.write(
            `${themed('warning', 'Warning:')} Could not fetch sandbox config for sync: ${sandboxError.message}\n`
          )
        }
        const overrides = syncConfig.sandboxes?.[sandboxId]?.rules
        const rules = mergeRules(syncConfig.rules, sandbox?.config?.sync, overrides)

        const cwd = process.cwd()
        for (const rule of rules) {
          rule.source = resolveSourcePath(rule.source, cwd)
        }
        const validRules = rules.filter((rule) => existsSync(rule.source))

        if (validRules.length) {
          const sessions = await syncManager.startAll(
            sandboxId,
            orgId,
            validRules,
            sandbox?.config?.sync,
            syncConfig.defaultIgnores
          )
          if (sessions.length) {
            syncStarted = true
            process.stdout.write(
              `${themed(`success`, `File sync started (${sessions.length} rule${sessions.length !== 1 ? 's' : ''})`)}\n`
            )
          }
        }
      } catch (err) {
        const msg = (err as Error).message
        const isAuthError = msg.includes(`(401)`) || msg.includes(`Not logged in`)
        if (isAuthError) {
          process.stderr.write(`${themed(`error`, `Error:`)} ${msg}\n`)
          process.exit(1)
        }
        process.stderr.write(
          `${themed(`warning`, `Warning: auto-sync failed:`)} ${msg}\n` +
            `${themed(`muted`, `SSH session will continue without file sync. Run "tsa sync" to retry.`)}\n`
        )
      }
    }

    const tsaBin = process.argv[0] || `tsa`
    const tsaScript = process.argv[1] || ``

    const proxyCmd = tsaScript
      ? `${tsaBin} ${tsaScript} proxy ${sandboxId}`
      : `${tsaBin} proxy ${sandboxId}`

    try {
      const sshProc = spawn(
        `ssh`,
        [
          `-o`,
          `ProxyCommand=${proxyCmd}`,
          `-o`,
          `StrictHostKeyChecking=no`,
          `-o`,
          `UserKnownHostsFile=/dev/null`,
          `-o`,
          `LogLevel=ERROR`,
          `sandbox@${sandboxId}`,
        ],
        { stdio: `inherit` }
      )

      await new Promise<void>((resolve, reject) => {
        sshProc.on(`close`, (code) => {
          if (code && code !== 0) {
            reject(new Error(`SSH exited with code ${code}`))
          } else {
            resolve()
          }
        })
        sshProc.on(`error`, (err: any) => {
          if (err.code === `ENOENT`) {
            reject(new Error(`ssh not found. Install OpenSSH to connect to sandboxes.`))
          } else {
            reject(err)
          }
        })
      })
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
    } finally {
      if (syncStarted) {
        try {
          await syncManager.stopAll(sandboxId)
          process.stdout.write(`${themed(`muted`, `File sync stopped`)}\n`)
        } catch (err) {
          process.stderr.write(
            `Warning: could not stop sync sessions: ${(err as Error).message}\n` +
              `Run "tsa sync stop ${sandboxId}" to clean up manually.\n`
          )
        }
      }
    }
  }),
}
