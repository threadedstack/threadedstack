import type { TABConfig } from '@TBE/types'

export const adminPath = (config:TABConfig) => {
  return `/${config?.server?.adminPath || `_`}`
}