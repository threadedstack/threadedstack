import type { TApp } from '@TBE/types'

import { createScheduler } from '@TBE/services/scheduler'
import { createScheduleExecutor } from '@TBE/services/scheduler/executor'

export const setupScheduler = (app: TApp) => {
  const executor = createScheduleExecutor(app)
  app.locals.scheduleExecutor = executor
  // Pass `app` so the scheduler can hand each orphaned running row to the
  // rehydrator (which needs sandbox+kube+s3 from app.locals). Without app the
  // scheduler still ticks but skips hydration on startup.
  const scheduler = createScheduler(app.locals.db, executor, app)
  scheduler.start()

  return scheduler
}
