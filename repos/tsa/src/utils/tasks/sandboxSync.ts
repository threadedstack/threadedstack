import type { TSyncConfig } from '@tdsk/domain'
import type { ApiClient } from '@TSA/services/api'

import { existsSync } from 'fs'
import { themed } from '@TSA/theme'
import { CliDriver } from '@TSA/services/sync/mutagenClient'
import { SyncManager } from '@TSA/services/sync/syncManager'
import { mergeRules, resolveSourcePath } from '@TSA/services/sync/configLoader'

/**
 * Creates a fresh SyncManager and tracking state for a sync lifecycle.
 */
export const createSyncContext = () => {
  const driver = new CliDriver()
  const manager = new SyncManager(driver)
  return { manager, started: false }
}

/**
 * Auto-starts file sync if the config has autoStart enabled and rules defined.
 * Best-effort: sync failures do not block the caller (except auth errors, which re-throw).
 * Mutates `ctx.started` to true when sessions are successfully created.
 */
export const autoStartSync = async (
  ctx: { manager: SyncManager; started: boolean },
  syncConfig: TSyncConfig | undefined,
  client: ApiClient,
  orgId: string,
  sandboxId: string
): Promise<void> => {
  if (!syncConfig?.autoStart || !syncConfig?.rules?.length) return

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
    const sandboxWorkdir = sandbox?.config?.workdir
    const syncDefaults = sandbox?.config?.sync
      ? sandboxWorkdir && !sandbox.config.sync.targetBase
        ? { ...sandbox.config.sync, targetBase: sandboxWorkdir }
        : sandbox.config.sync
      : sandboxWorkdir
        ? { targetBase: sandboxWorkdir }
        : undefined
    const rules = mergeRules(syncConfig.rules, syncDefaults, overrides)

    const cwd = process.cwd()
    for (const rule of rules) {
      rule.source = resolveSourcePath(rule.source, cwd)
    }
    const validRules = rules.filter((rule) => existsSync(rule.source))

    if (validRules.length) {
      const sessions = await ctx.manager.startAll(
        sandboxId,
        orgId,
        validRules,
        sandbox?.config?.sync,
        syncConfig.defaultIgnores
      )
      if (sessions.length) {
        ctx.started = true
        process.stdout.write(
          `${themed(`success`, `File sync started (${sessions.length} rule${sessions.length !== 1 ? 's' : ''})`)}\n`
        )
      }
    }
  } catch (err) {
    const msg = (err as Error).message
    const isAuthError = msg.includes(`(401)`) || msg.includes(`Not logged in`)
    if (isAuthError) {
      throw new Error(msg)
    }
    process.stderr.write(
      `${themed(`warning`, `Warning: auto-sync failed:`)} ${msg}\n` +
        `${themed(`muted`, `SSH session will continue without file sync. Run "tsa sync" to retry.`)}\n`
    )
  }
}

/**
 * Stops all sync sessions for a sandbox. Best-effort cleanup.
 * Only runs if sync was actually started (ctx.started is true).
 */
export const stopSync = async (
  ctx: { manager: SyncManager; started: boolean },
  sandboxId: string
): Promise<void> => {
  if (!ctx.started) return

  try {
    await ctx.manager.stopAll(sandboxId)
    process.stdout.write(`${themed(`muted`, `File sync stopped`)}\n`)
  } catch (err) {
    process.stderr.write(
      `Warning: could not stop sync sessions: ${(err as Error).message}\n` +
        `Run "tsa sync stop ${sandboxId}" to clean up manually.\n`
    )
  }
}
