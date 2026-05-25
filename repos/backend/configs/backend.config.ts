import type { ESubscriptionTier } from '@tdsk/domain'
import type { EEmailType, EPayType, TPayEnv, TS3Config } from '@TBE/types'

import { toNum, toBool } from '@keg-hub/jsutils'
import { loadEnvs, parsePayPlans } from '@tdsk/domain'

const nodeEnv = process.env.NODE_ENV || `local`

const resolveSBDomain = (domain: string) => {
  return domain || `sandbox.${nodeEnv}.threadedstack.app`
}

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
  TDSK_PAY_ACCESS_TOKEN = ``,
  TDSK_PAY_WEBHOOK_SECRET = ``,
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
  TDSK_EMAIL_FROM = `noreply@notifications.threadedstack.com`,

  TDSK_S3_BUCKET,
  TDSK_S3_REGION,
  TDSK_S3_ENDPOINT,
  TDSK_S3_ACCESS_KEY_ID,
  TDSK_S3_SECRET_ACCESS_KEY,

  // ENVs specific to dynamic sandboxes
  TDSK_SB_DOMAIN,
  TDSK_SB_RUNTIME_CLASS,
  TDSK_SB_TIMEOUT_MIN = `30`,
  TDSK_SB_IMAGE_TAG = `latest`,
  TDSK_SB_MAX_WAIT_MS = `120000`,
  TDSK_SB_POLL_INTERVAL_MS = `2000`,
  TDSK_SB_IDLE_INTERVAL_MS = `60_000`,
  TDSK_SB_IMAGE = `ghcr.io/threadedstack/tdsk-sandbox`,
  TDSK_SB_INIT_IMAGE = `ghcr.io/threadedstack/tdsk-init`,

  // The deployed proxy host url
  // New domains are validated against this URL to ensure the CName is configured properly
  TDSK_CADDY_PX_HOST,
  TDSK_CADDY_PREWARM_HEADER,
} = process.env

const { priceIds, seatPriceIds } = parsePayPlans(TDSK_PAY_PLANS)

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
    initImage: TDSK_SB_INIT_IMAGE,
    serviceName: TDSK_BE_DEPLOYMENT,
    servicePort: toNum(TDSK_BE_EGRESS_PORT),
    certSecretName: TDSK_KUBE_SCRT_EGRESS_CA,
    serviceIp: undefined as string | undefined,
  },
  sandbox: {
    maxWait: toNum(TDSK_SB_MAX_WAIT_MS),
    timeoutMin: toNum(TDSK_SB_TIMEOUT_MIN),
    pollInterval: toNum(TDSK_SB_POLL_INTERVAL_MS),
    idleInterval: toNum(TDSK_SB_IDLE_INTERVAL_MS),
    image: `${TDSK_SB_IMAGE}:${TDSK_SB_IMAGE_TAG}`,
    domain: resolveSBDomain(TDSK_SB_DOMAIN?.trim() || undefined),
    runtimeClassName: TDSK_SB_RUNTIME_CLASS?.trim() || undefined,
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
    seatPriceIds,
    type: TDSK_PAY_TYPE as EPayType,
    secretKey: TDSK_PAY_ACCESS_TOKEN,
    webhookSecret: TDSK_PAY_WEBHOOK_SECRET,
    environment: process.env.NODE_ENV as TPayEnv,
    priceIds: priceIds as Record<ESubscriptionTier, string>,
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
  s3: {
    bucket: TDSK_S3_BUCKET,
    endpoint: TDSK_S3_ENDPOINT,
    accessKeyId: TDSK_S3_ACCESS_KEY_ID,
    region: TDSK_S3_REGION || undefined,
    secretAccessKey: TDSK_S3_SECRET_ACCESS_KEY,
    active: Boolean(
      TDSK_S3_BUCKET &&
        TDSK_S3_ENDPOINT &&
        TDSK_S3_ACCESS_KEY_ID &&
        TDSK_S3_SECRET_ACCESS_KEY
    ),
  } as TS3Config,
  domains: {
    proxyHost: TDSK_CADDY_PX_HOST,
    prewarmHeader: TDSK_CADDY_PREWARM_HEADER,
  },
}
