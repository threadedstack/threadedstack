import type { TLogLevel, TProxyConfig } from '@TPX/types'

import { loadEnvs } from '@tdsk/domain'
import { toInt } from '@keg-hub/jsutils/toInt'
import { toBool } from '@keg-hub/jsutils/toBool'

const { NODE_ENV = `local` } = process.env

const envs = loadEnvs({
  name: `tdsk`,
  override: NODE_ENV === `local`,
})

const {
  TDSK_PX_PORT,
  TDSK_PX_SSL_CA,
  TDSK_PX_SSL_KEY,
  TDSK_PX_SSL_CERT,
  TDSK_PX_ENABLE_SSL,
  TDSK_PX_ALLOW_ORIGIN,
  TDSK_PX_LOG_LEVEL,
  TDSK_PX_LOGGER_LEVEL,
  TDSK_PX_LOGGER_PRETTY,
  TDSK_PX_LOGGER_SILENT,
  TDSK_PX_JWT_SECRET,
  TDSK_PX_JWT_EXPIRES_IN,
  TDSK_PX_JWT_REFRESH_EXPIRES_IN,
  TDSK_BE_URL,
  TDSK_BE_HOST,
  TDSK_BE_PORT,
  TDSK_BE_HEADER_KEY,
  TDSK_BE_HEADER_VALUE,
  TDSK_BE_API_ADMIN_PATH = `_`,
  TDSK_AUTH_JWKS = ``,
} = envs

const enableSSL = NODE_ENV !== `production` && toBool(TDSK_PX_ENABLE_SSL)

const backendUrl = () => {
  if (TDSK_BE_URL) return new URL(TDSK_BE_URL).toString()
  if (!TDSK_BE_HOST) throw new Error(`A valid URL or host is required!`)

  let built = TDSK_BE_HOST
  if (!TDSK_BE_HOST.startsWith(`http`)) built = `http://${TDSK_BE_HOST}`
  if (TDSK_BE_PORT) built = `${built}:${TDSK_BE_PORT}`

  return new URL(built).toString()
}

export const config: TProxyConfig = {
  jwt: {
    secret: TDSK_PX_JWT_SECRET || `tdsk-dev-secret-change-in-production`,
    expiresIn: TDSK_PX_JWT_EXPIRES_IN || `7d`,
    refreshExpiresIn: TDSK_PX_JWT_REFRESH_EXPIRES_IN || `30d`,
  },
  server: {
    enableSSL,
    port: toInt(TDSK_PX_PORT) || 4000,
    origins: (TDSK_PX_ALLOW_ORIGIN || `http://localhost:5887`).split(`,`),
    certs: enableSSL
      ? {
          ca: TDSK_PX_SSL_CA,
          key: TDSK_PX_SSL_KEY,
          cert: TDSK_PX_SSL_CERT,
        }
      : undefined,
  },
  backend: {
    url: backendUrl(),
    headerKey: TDSK_BE_HEADER_KEY,
    headerValue: TDSK_BE_HEADER_VALUE,
    adminPath: TDSK_BE_API_ADMIN_PATH,
  },
  logger: {
    label: `TDSK - Proxy`,
    exceptions: true,
    rejections: true,
    exitOnError: false,
    pretty: toBool(TDSK_PX_LOGGER_PRETTY) ?? false,
    silent: toBool(TDSK_PX_LOGGER_SILENT) ?? false,
    level: (TDSK_PX_LOGGER_LEVEL || TDSK_PX_LOG_LEVEL || `info`) as TLogLevel,
  },
  jwks: {
    jwksUrl: TDSK_AUTH_JWKS,
  },
}
