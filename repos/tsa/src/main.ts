#!/usr/bin/env bun

import util from 'node:util'
import { main } from '@TSA/cli'
import { themed } from '@TSA/theme'
import { runSyncCleanup } from '@TSA/utils/tasks/syncCleanupRegistry'

util.inspect.defaultOptions.depth = null
process.env.STL_FORCE_DISABLE_SAFE = `1`

let cleaningUp = false
const signalCleanup = async () => {
  if (cleaningUp) return
  cleaningUp = true

  const forceTimer = setTimeout(() => process.exit(1), 5_000)
  try {
    await runSyncCleanup()
  } catch {
    // Best-effort — daemon may already be stopped
  }
  clearTimeout(forceTimer)
  process.exit(0)
}

process.on(`SIGINT`, signalCleanup)
process.on(`SIGTERM`, signalCleanup)

main().catch(async (err) => {
  try {
    await runSyncCleanup()
  } catch {
    /* best-effort */
  }
  process.stderr.write(`${themed(`error`, `Fatal:`)} ${err.message}\n`)
  process.exit(1)
})
