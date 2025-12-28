const ensureEnv = (env: string, name: string): string => {
  if (!env?.trim?.())
    throw new Error(
      `The env "${name}" value "${env}" is invalid. Ensure it is set to a valid value`
    )

  return env
}

export const TDSK_AD_APP_VERSION = ensureEnv(
  process.env.TDSK_AD_APP_VERSION,
  `TDSK_AD_APP_VERSION`
)

export const TDSK_BE_HOST = process.env.TDSK_BE_HOST
export const TDSK_BE_PORT = process.env.TDSK_BE_PORT
export const TDSK_BE_API_ADMIN_PATH = process.env.TDSK_BE_API_ADMIN_PATH

const envPath = process.env.TDSK_AD_BASE_PATH
export const TDSK_AD_BASE_PATH = envPath?.startsWith?.(`/`) ? envPath : `/`

export const Environment = process.env.NODE_ENV || `local`
export const TDSK_DB_URL = process.env.TDSK_DB_URL
export const TDSK_DB_NAME = process.env.TDSK_DB_NAME
export const TDSK_DB_TYPE = process.env.TDSK_DB_TYPE
export const TDSK_DB_PUBLIC_KEY = process.env.TDSK_DB_PUBLIC_KEY
export const TDSK_AUTH_PROVIDERS = (process.env.TDSK_AUTH_PROVIDERS || `github`).split(`,`)

export const TDSK_POSTHOG_KEY = process.env.TDSK_POSTHOG_KEY
export const TDSK_POSTHOG_HOST = process.env.TDSK_POSTHOG_HOST

