import hq from 'alias-hq'
import path from 'node:path'
import { loadEnvs } from '@tdsk/domain'
import { defineConfig } from 'drizzle-kit'
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

export default defineConfig({
  out: aliases[`@TDB/drizzle`],
  schemaFilter: [`public`],
  schema: path.join(aliases[`@TDB`], `schemas`, `schemas.ts`),
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
    }),
  },
})
