import { config } from '@TDB/configs/db.config'
import { buildApiLogger } from '@tdsk/logger'

export const logger = buildApiLogger(config?.logger?.label, config?.logger?.level)
