export const Environment = process.env.NODE_ENV || `local`
export const TDSK_POSTHOG_KEY = process.env.TDSK_POSTHOG_KEY
export const TDSK_POSTHOG_HOST = process.env.TDSK_POSTHOG_HOST
export const TDSK_AD_APP_URL = process.env.TDSK_AD_APP_URL || `http://localhost:5887`

export const VITEST = Boolean(import.meta.env.VITEST || process.env.VITEST)
