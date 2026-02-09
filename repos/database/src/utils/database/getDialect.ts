import type { TDBConfig, TDBDialect } from '@TDB/types'
import { EDBDialects } from '@TDB/types'

export const getDialect = (config: Partial<TDBConfig>): TDBDialect => {
  return (
    EDBDialects[config.dialect] || EDBDialects[config.proto] || EDBDialects.postgresql
  )
}
