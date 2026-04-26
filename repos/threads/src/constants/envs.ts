import type { TAuthProvider } from '@tdsk/components'

const ensureEnv = (env: string, name: string): string => {
  if (!env?.trim?.())
    throw new Error(
      `The env "${name}" value "${env}" is invalid. Ensure it is set to a valid value`
    )

  return env
}

export const TDSK_TH_APP_VERSION = ensureEnv(
  process.env.TDSK_TH_APP_VERSION,
  `TDSK_TH_APP_VERSION`
)

export const TDSK_PX_URL = process.env.TDSK_PX_URL
export const TDSK_PX_PORT = process.env.TDSK_PX_PORT
export const TDSK_PX_HOST = process.env.TDSK_PX_HOST
export const TDSK_CADDY_PX_HOST = process.env.TDSK_CADDY_PX_HOST
export const TDSK_BE_API_ADMIN_PATH = process.env.TDSK_BE_API_ADMIN_PATH

const envPath = process.env.TDSK_TH_BASE_PATH
export const TDSK_TH_BASE_PATH = envPath?.startsWith?.(`/`) ? envPath : `/`

export const Environment = process.env.NODE_ENV || `local`

export const TDSK_AUTH_URL = ensureEnv(process.env.TDSK_AUTH_URL, `TDSK_AUTH_URL`)
export const TDSK_AUTH_PROVIDERS = (process.env.TDSK_AUTH_PROVIDERS || `github`).split(
  `,`
) as TAuthProvider[]

export const TDSK_POSTHOG_KEY = process.env.TDSK_POSTHOG_KEY
export const TDSK_POSTHOG_HOST = process.env.TDSK_POSTHOG_HOST

export const VITEST = Boolean(import.meta.env.VITEST || process.env.VITEST)
