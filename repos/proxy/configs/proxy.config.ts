import type { TLogLevel, TProxyConfig } from '@TPX/types'

import { loadEnvs } from '@tdsk/domain'
import { toInt } from '@keg-hub/jsutils/toInt'
import { LOG_LEVEL } from '@TPX/constants/envs'
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
  TDSK_PX_LOGGER_LEVEL,
  TDSK_PX_LOGGER_PRETTY,
  TDSK_PX_LOGGER_SILENT,
  TDSK_PX_BACKEND_URL,
  TDSK_PX_HEADER_KEY,
  TDSK_PX_HEADER_VALUE,
  TDSK_PX_JWT_SECRET,
  TDSK_PX_JWT_EXPIRES_IN,
  TDSK_PX_JWT_REFRESH_EXPIRES_IN,
  TDSK_BE_API_ADMIN_PATH = `_`,
} = envs

const enableSSL = NODE_ENV !== `production` && toBool(TDSK_PX_ENABLE_SSL)

export const config: TProxyConfig = {
  jwt: {
    secret: TDSK_PX_JWT_SECRET || `tdsk-dev-secret-change-in-production`,
    expiresIn: TDSK_PX_JWT_EXPIRES_IN || `7d`,
    refreshExpiresIn: TDSK_PX_JWT_REFRESH_EXPIRES_IN || `30d`,
  },
  server: {
    enableSSL,
    port: toInt(TDSK_PX_PORT) || 4000,
    origins: (TDSK_PX_ALLOW_ORIGIN || `http://localhost:3000`).split(`,`),
    certs: enableSSL
      ? {
          ca: TDSK_PX_SSL_CA,
          key: TDSK_PX_SSL_KEY,
          cert: TDSK_PX_SSL_CERT,
        }
      : undefined,
  },
  backend: {
    path: TDSK_BE_API_ADMIN_PATH,
    url: TDSK_PX_BACKEND_URL || `http://localhost:5000`,
    headerKey: TDSK_PX_HEADER_KEY,
    headerValue: TDSK_PX_HEADER_VALUE,
  },
  logger: {
    label: `TDSK - Proxy`,
    exceptions: true,
    rejections: true,
    exitOnError: false,
    pretty: toBool(TDSK_PX_LOGGER_PRETTY) ?? false,
    silent: toBool(TDSK_PX_LOGGER_SILENT) ?? false,
    level: (TDSK_PX_LOGGER_LEVEL ?? LOG_LEVEL) as TLogLevel,
  },
}
