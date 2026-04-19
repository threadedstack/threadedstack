import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { CliDriver } from '@TSA/services/sync/mutagenClient'
import { SyncManager } from '@TSA/services/sync/syncManager'

export const logout: TTask = {
  name: `logout`,
  alias: [`lo`],
  description: `Remove stored credentials`,
  example: `tsa logout`,
  action: async ({ auth }) => {
    // Best-effort: terminate all sync sessions before removing credentials
    try {
      const driver = new CliDriver()
      const manager = new SyncManager(driver)
      const sessions = await manager.status()
      if (sessions.length > 0) {
        process.stdout.write(
          `${themed(`muted`, `Stopping ${sessions.length} sync session${sessions.length !== 1 ? `s` : ``}...`)}\n`
        )
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
            `${themed(`warning`, `Warning: could not stop ${errors.length} session(s):`)} ${errors.join(`; `)}\n` +
              `${themed(`muted`, `Run "tsa sync cleanup" to remove orphaned sessions.`)}\n`
          )
        } else {
          process.stdout.write(`${themed(`muted`, `Sync sessions stopped`)}\n`)
        }
      }
    } catch (err) {
      process.stderr.write(
        `${themed(`warning`, `Warning: could not stop sync sessions:`)} ${(err as Error).message}\n`
      )
    }

    auth.logout()
    process.stdout.write(`${themed('success', `Logged out`)}\n`)
  },
}
