import { buildApiLogger } from '@tdsk/logger'
import { config } from '@TPX/configs/proxy.config'

export const logger = buildApiLogger(config?.logger?.label, config?.logger?.level)
