import hq from 'alias-hq'
import path from 'node:path'
import { loadEnvs } from '@tdsk/domain'
import { defineConfig } from 'drizzle-kit'
import { getTableName } from 'drizzle-orm'
import * as schemas from '@TDB/schemas/schemas'
import { buildDBUrl } from '@TDB/utils/database/buildDBUrl'
import { getDialect } from '@TDB/utils/database/getDialect'

const aliases = hq.get(`webpack`)
const nodeEnv = process.env.NODE_ENV || `local`
const envs = loadEnvs({
  name: `tdsk`,
  override: nodeEnv === `local`,
})

const {
  TDSK_DB_URL,
  TDSK_DB_NAME,
  TDSK_DB_USER,
  TDSK_DB_PASS,
  TDSK_DB_PROTO,
  TDSK_DB_DIALECT = `postgresql`,
} = envs

/**
 * Get all the tables names that should be impacted
 * Does not included table names that should NOT be managed by drizzle
 * I.E. `users` and `certificates`
 */
const tables = Object.entries(schemas).reduce((acc, [name, table]) => {
  const tn = getTableName(table as any)
  tn && acc.push(tn)
  return acc
}, [] as string[])

export default defineConfig({
  tablesFilter: tables,
  schemaFilter: [`public`],
  schema: path.join(aliases[`@TDB`], `schemas`, `schemas.ts`),
  out: path.relative(aliases[`@TDB/root`], aliases[`@TDB/drizzle`]),
  introspect: {
    casing: `camel`,
  },
  dialect: getDialect({
    proto: TDSK_DB_PROTO,
    dialect: TDSK_DB_DIALECT,
  }),
  dbCredentials: {
    url: buildDBUrl({
      url: TDSK_DB_URL,
      name: TDSK_DB_NAME,
      user: TDSK_DB_USER,
      pass: TDSK_DB_PASS,
      proto: TDSK_DB_PROTO,
    }),
  },
})
