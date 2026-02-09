import type { TApp } from '@tdsk/domain'
import { database } from '@tdsk/database'
import { logger } from '@TBE/utils/logger'

export const setupDatabase = (app: TApp) => {
  try {
    app.locals.db = database()
    logger.info(`Database initialized successfully`)
  } catch (error) {
    logger.error(`Failed to initialize database:`, error)
    throw error
  }
}
