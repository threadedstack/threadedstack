import type { TProxyApp } from '@TPX/types'
import { database } from '@tdsk/database'
import { logger } from '@TPX/utils/logger'

export const setupDatabase = (app: TProxyApp) => {
  try {
    app.locals.db = database()
    logger.info(`Database initialized successfully`)
  } catch (error) {
    logger.error(`Failed to initialize database:`, error)
    throw error
  }
}
