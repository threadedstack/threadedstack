import { ApiLogger, setupLogger } from '@tdsk/logger'
import { config } from '@TPX/configs/proxy.config'

setupLogger({
  tag: `TDSK Proxy`,
  level: config?.logger?.level,
})

export { ApiLogger as logger }
