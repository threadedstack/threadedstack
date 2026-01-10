import type { TApp } from '@tdsk/domain'
import { database } from '@tdsk/database'

export const setupDatabase = (app: TApp) => {
  app.locals.db = database(app.locals.config.database)
}
