import type { EEmailType, EPayType, TPayEnv } from '@TBE/types'
import { toNum, toBool } from '@keg-hub/jsutils'
import { loadEnvs, parsePayPlans } from '@tdsk/domain'

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
  TDSK_BE_LOG_LEVEL,
  TDSK_BE_HEADER_KEY,
  TDSK_BE_DEPLOYMENT,
  TDSK_BE_HEADER_VALUE,
  TDSK_BE_ALLOW_ORIGIN,
  TDSK_BE_LOGGER_PRETTY,
  TDSK_BE_LOGGER_SILENT,
  TDSK_BE_PUBLIC_ROUTES,
  TDSK_BE_API_ADMIN_PATH,
  TDSK_LOG_LEVEL = `info`,
  TDSK_BE_EGRESS_PORT = 8889,
  TDSK_KUBE_SCRT_EGRESS_CA = `tdsk-egress-ca`,

  TDSK_PAY_TYPE,
  TDSK_PAY_PLANS,
  TDSK_PAY_URL = ``,
  TDSK_PAY_WEBHOOK_SECRET = ``,
  TDSK_PAY_ACCESS_TOKEN = `invalid`,
  // Frontend URL for email links (invitation emails, password reset, etc.)
  // Falls back to localhost:5887 for local development
  TDSK_FRONTEND_URL,
  TDSK_AD_PORT = 5887,

  TDSK_EMAIL_TYPE,
  TDSK_EMAIL_HOST,
  TDSK_EMAIL_PORT,
  TDSK_EMAIL_USER,
  TDSK_EMAIL_PASS,
  TDSK_EMAIL_SECURE,
  TDSK_EMAIL_API_KEY,
  TDSK_EMAIL_API_HOST,
  TDSK_EMAIL_FROM = `noreply@threadedstack.com`,

  // The deployed proxy host url
  // New domains are validated against this URL to ensure the CName is configured properly
  TDSK_CADDY_PX_HOST,
  TDSK_CADDY_PREWARM_HEADER,
} = process.env

export const config = {
  frontendUrl: TDSK_FRONTEND_URL || `http://localhost:${TDSK_AD_PORT}`,
  server: {
    port: toNum(TDSK_BE_PORT),
    label: `TDSK - Backend`,
    environment: process.env.NODE_ENV,
    adminPath: TDSK_BE_API_ADMIN_PATH,
    origins: (TDSK_BE_ALLOW_ORIGIN || '').split(','),
  },
  egress: {
    serviceName: TDSK_BE_DEPLOYMENT,
    servicePort: toNum(TDSK_BE_EGRESS_PORT),
    certSecretName: TDSK_KUBE_SCRT_EGRESS_CA,
    serviceIp: undefined as string | undefined,
  },
  proxy: {
    // Validate if this URL field is needed
    url: ``,
    headerKey: TDSK_BE_HEADER_KEY,
    headerValue: TDSK_BE_HEADER_VALUE,
    publicRoutes: (TDSK_BE_PUBLIC_ROUTES || ``)
      .split(`,`)
      .map((part) => part.trim())
      .filter(Boolean),
  },
  logger: {
    exceptions: true,
    rejections: true,
    exitOnError: false,
    label: `TDSK - Backend`,
    level: TDSK_BE_LOG_LEVEL ?? TDSK_LOG_LEVEL,
    pretty: toBool(TDSK_BE_LOGGER_PRETTY) ?? false,
    silent: toBool(TDSK_BE_LOGGER_SILENT) ?? false,
  },
  payments: {
    url: TDSK_PAY_URL,
    token: TDSK_PAY_ACCESS_TOKEN,
    type: TDSK_PAY_TYPE as EPayType,
    wbhSecret: TDSK_PAY_WEBHOOK_SECRET,
    plans: parsePayPlans(TDSK_PAY_PLANS),
    environment: process.env.NODE_ENV as TPayEnv,
  },
  email: {
    from: TDSK_EMAIL_FROM,
    type: TDSK_EMAIL_TYPE as EEmailType,
    api: TDSK_EMAIL_API_KEY
      ? {
          key: TDSK_EMAIL_API_KEY,
          host: TDSK_EMAIL_API_HOST,
        }
      : undefined,
    smtp: TDSK_EMAIL_HOST
      ? {
          host: TDSK_EMAIL_HOST,
          user: TDSK_EMAIL_USER || ``,
          pass: TDSK_EMAIL_PASS || ``,
          port: toNum(TDSK_EMAIL_PORT) || 587,
          secure: toBool(TDSK_EMAIL_SECURE) || false,
        }
      : undefined,
  },
  domains: {
    proxyHost: TDSK_CADDY_PX_HOST,
    prewarmHeader: TDSK_CADDY_PREWARM_HEADER,
  },
}
