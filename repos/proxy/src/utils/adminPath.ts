import type { TProxyConfig } from '@TPX/types'

export const adminPath = (config: TProxyConfig) => {
  return `/${config?.backend?.path || `_`}`
}
