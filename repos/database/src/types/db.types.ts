import type * as DBservices from '@TDB/services'
import type { Config as DBConfig } from 'drizzle-kit'
import type { config } from '@TDB/configs/db.config'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export type TDBDialect = DBConfig[`dialect`]

export enum EDBDialects {
  gel = `gel`,
  mysql = `mysql`,
  turso = `turso`,
  sqlite = `sqlite`,
  pg = `postgresql`,
  postgres = `postgresql`,
  postgresql = `postgresql`,
  singlestore = `singlestore`,
}

export type TDBConfig = typeof config

export type TDBServices = {
  [K in keyof typeof DBservices]: InstanceType<(typeof DBservices)[K]>
}

export type TDatabase = NodePgDatabase & {
  services: TDBServices
}
