import type { TApp } from '@TBE/types'

import { createScheduler } from '@TBE/services/scheduler'
import { createScheduleExecutor } from '@TBE/services/scheduler/executor'

export const setupScheduler = (app: TApp) => {
  const executor = createScheduleExecutor(app)
  app.locals.scheduleExecutor = executor
  const scheduler = createScheduler(app.locals.db, executor)
  scheduler.start()

  return scheduler
}
