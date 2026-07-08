import type { TApp } from '@TBE/types'

import { createResidentWatchdog } from '@TBE/services/resident/watchdog'

/**
 * Start the resident watchdog alongside the scheduler (same lifecycle home:
 * created in main, stopped by signals) — a SIBLING reconciler that owns
 * resident pod lifecycles, never entangled with the schedule tick. Inert
 * until a resident_configs record exists (R4 activation).
 */
export const setupResidentWatchdog = (app: TApp) => {
  const watchdog = createResidentWatchdog(app)
  app.locals.residentWatchdog = watchdog
  watchdog.start()

  return watchdog
}
