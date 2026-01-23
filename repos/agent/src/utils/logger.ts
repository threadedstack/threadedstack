import { config } from '@TAG/configs/agent.config'
import { buildApiLogger } from '@tdsk/logger'

export const logger = buildApiLogger(config?.logger?.label, config?.logger?.level)
