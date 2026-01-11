import { loadEnvs } from '@tdsk/domain'
import { buildDBUrl } from '@TDB/utils/database/buildDBUrl'

const {
  TDSK_DB_USER,
  TDSK_DB_PASS,
  TDSK_DB_JWT_SCRT,
  TDSK_DB_SRV_ROLE,
  TDSK_DB_PUBLIC_KEY,
  TDSK_DB_PROJECT_ID,
  TDSK_DB_LOG_LEVEL,
  TDSK_LOG_LEVEL = `info`,
  TDSK_DB_LOG_LABEL = `TDSK - Database`,
} = process.env

const nodeEnv = process.env.NODE_ENV || `local`
const envs = loadEnvs({
  name: `tdsk`,
  override: nodeEnv === `local`,
})

const { TDSK_DB_URL, TDSK_DB_NAME, TDSK_DB_TYPE, TDSK_DB_PROTO, TDSK_DB_DIALECT } = envs

export const config = {
  type: TDSK_DB_TYPE,
  name: TDSK_DB_NAME,
  user: TDSK_DB_USER,
  pass: TDSK_DB_PASS,
  proto: TDSK_DB_PROTO,
  jwt: TDSK_DB_JWT_SCRT,
  role: TDSK_DB_SRV_ROLE,
  dialect: TDSK_DB_DIALECT,
  public: TDSK_DB_PUBLIC_KEY,
  project: TDSK_DB_PROJECT_ID,
  url: buildDBUrl({
    url: TDSK_DB_URL,
    name: TDSK_DB_NAME,
    user: TDSK_DB_USER,
    pass: TDSK_DB_PASS,
    proto: TDSK_DB_PROTO,
  }),
  logger: {
    label: TDSK_DB_LOG_LABEL,
    level: TDSK_DB_LOG_LEVEL ?? TDSK_LOG_LEVEL,
  },
}
