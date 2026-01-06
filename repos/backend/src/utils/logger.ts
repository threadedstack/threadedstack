import { ApiLogger, setupLogger } from '@tdsk/logger'
import { config } from '@TBE/configs/backend.config'

setupLogger({
  tag: `TDSK Accounts Backend`,
  level: config?.logger?.level,
})

export { ApiLogger as logger }
