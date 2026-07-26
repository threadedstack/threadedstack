import type { TApp } from '@TBE/types'

import { createRetentionCleanup } from '@TBE/services/retention/retentionCleanup'

export const setupRetentionCleanup = (app: TApp) => {
  const job = createRetentionCleanup(app.locals.db)
  job.start()

  return job
}
