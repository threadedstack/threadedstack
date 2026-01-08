import type { Express } from 'express'
import type { TProxyConfig } from '@TPX/types/config.types'

export type TProxyApp = Express & {
  locals: {
    config: TProxyConfig
  }
}
