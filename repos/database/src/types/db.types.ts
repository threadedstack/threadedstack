import type { Config as DBConfig } from 'drizzle-kit'
import type { config } from '@TDB/configs/db.config'

export type TDBDialect = DBConfig[`dialect`]

export enum EDBDialects {
  gel=`gel`,
  mysql=`mysql`,
  turso=`turso`,
  sqlite=`sqlite`,
  pg=`postgresql`,
  postgres=`postgresql`,
  postgresql=`postgresql`,
  singlestore=`singlestore`,
}

export type TDBConfig = typeof config
