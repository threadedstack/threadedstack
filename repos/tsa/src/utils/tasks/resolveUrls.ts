import type { TTsaConfig } from '@TSA/types'
import { EnvUrlMap, CliAuthPath } from '@TSA/constants/api'

type TEnvName = keyof typeof EnvUrlMap

const getEnvUrls = () => {
  const env = process.env.NODE_ENV as TEnvName | undefined
  return EnvUrlMap[env as TEnvName] ?? EnvUrlMap.local
}

export const resolveProxyUrl = (config?: TTsaConfig): string => {
  if (config?.auth?.proxyUrl) return config.auth.proxyUrl

  const envUrl = process.env.TDSK_PX_URL
  if (envUrl) return envUrl.replace(/\/$/, ``)

  return getEnvUrls().proxy
}

export const resolveThreadsUrl = (config?: TTsaConfig): string => {
  if (config?.auth?.threadsUrl) return config.auth.threadsUrl

  const envUrl = process.env.TDSK_TH_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, ``)

  return getEnvUrls().threads
}

export const resolveAuthUrl = (config?: TTsaConfig): string => {
  if (config?.auth?.authUrl)
    return `${config.auth.authUrl.replace(/\/$/, ``)}${CliAuthPath}`

  const threadsBase = resolveThreadsUrl(config)
  return `${threadsBase}${CliAuthPath}`
}
