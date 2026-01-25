import { config } from '@TSH/configs/shell.config'
import { buildApiLogger } from '@tdsk/logger'

export const logger = buildApiLogger(config?.logger?.label, config?.logger?.level)
