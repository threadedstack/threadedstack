import { loadEnvs } from '@tdsk/domain'
import { toNum, toBool } from '@keg-hub/jsutils'
import { LOG_LEVEL } from '@TBE/constants/envs'
import { buildProxyUrl } from '@TBE/utils/proxy/buildProxyUrl'

const nodeEnv = process.env.NODE_ENV || `local`

/*
 * Load the Envs for the configuration files from the repo root, and then add them to the process.
 * When running locally we want to make it easy to update the values by just changing the values.yml file
 * But in deployed envs, we want don't want to override the environments ENVs
 * So only pass true when in local, so the values.yml file becomes the source of truth
 */
loadEnvs({ force: nodeEnv === `local` })

const {
  TDSK_BE_PORT,
  TDSK_BE_REMOTE,
  TDSK_BE_SSL_CA,
  TDSK_BE_SSL_KEY,
  TDSK_BE_SSL_CERT,
  TDSK_BE_ENABLE_SSL,
  TDSK_BE_HEADER_KEY,
  TDSK_BE_REMOTE_PORT,
  TDSK_BE_HEADER_VALUE,
  TDSK_BE_ALLOW_ORIGIN,
  TDSK_BE_LOGGER_LEVEL,
  TDSK_BE_LOGGER_PRETTY,
  TDSK_BE_LOGGER_SILENT,
  TDSK_BE_PUBLIC_ROUTES,
  TDSK_BE_API_ADMIN_PATH,
  TDSK_DB_URL,
  TDSK_DB_TYPE,
  TDSK_DB_NAME,
  TDSK_DB_JWT_SCRT,
  TDSK_DB_SRV_ROLE,
  TDSK_DB_JWT_CREDS,
  TDSK_DB_PUBLIC_KEY,
} = process.env

const enableSSL = nodeEnv !== `production` && toBool(TDSK_BE_ENABLE_SSL)

if(enableSSL && (!TDSK_BE_SSL_CERT || !TDSK_BE_SSL_KEY))
  throw new Error(`SSL is enabled, but missing SSL cert ( TDSK_BE_SSL_CERT ) and or SSL key ( TDSK_BE_SSL_KEY ) envs`)

export const config = {
  server: {
    enableSSL,
    port: toNum(TDSK_BE_PORT),
    label: `TDSK - Backend`,
    environment: process.env.NODE_ENV,
    adminPath: TDSK_BE_API_ADMIN_PATH,
    origins: (TDSK_BE_ALLOW_ORIGIN || '').split(','),
    jwt: {
      secret: TDSK_DB_JWT_SCRT,
      active: toBool(TDSK_DB_JWT_CREDS || true),
    },
    certs: {
      ca: TDSK_BE_SSL_CA,
      key: TDSK_BE_SSL_KEY,
      cert: TDSK_BE_SSL_CERT,
    },
  },
  proxy: {
    headerKey: TDSK_BE_HEADER_KEY,
    headerValue: TDSK_BE_HEADER_VALUE,
    url: buildProxyUrl(TDSK_BE_REMOTE, TDSK_BE_REMOTE_PORT),
    publicRoutes: (TDSK_BE_PUBLIC_ROUTES || ``)
      .split(`,`)
      .map((part) => part.trim())
      .filter(Boolean),
  },
  database: {
    type: TDSK_DB_TYPE,
    [TDSK_DB_TYPE]: {
      url: TDSK_DB_URL,
      name: TDSK_DB_NAME,
      jwt: TDSK_DB_JWT_SCRT,
      role: TDSK_DB_SRV_ROLE,
      public: TDSK_DB_PUBLIC_KEY,
    }
  },
  logger: {
    label: `TDSK - Backend`,
    exceptions: true,
    rejections: true,
    exitOnError: false,
    level: TDSK_BE_LOGGER_LEVEL ?? LOG_LEVEL,
    pretty: toBool(TDSK_BE_LOGGER_PRETTY) ?? false,
    silent: toBool(TDSK_BE_LOGGER_SILENT) ?? false,
  },
}