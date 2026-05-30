export const Environment = process.env.NODE_ENV || `local`
export const TDSK_POSTHOG_KEY = process.env.TDSK_POSTHOG_KEY
export const TDSK_POSTHOG_HOST = process.env.TDSK_POSTHOG_HOST
export const VITEST = Boolean(import.meta.env.VITEST || process.env.VITEST)
export const TDSK_CADDY_PX_HOST = process.env.TDSK_CADDY_PX_HOST || `px.threadedstack.app`
export const TDSK_AD_APP_URL =
  process.env.TDSK_AD_APP_URL || `https://admin.threadedstack.com`
