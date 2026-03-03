import type { IWebProvider } from '@TAG/types'
import type { TWebProviderConfig } from '@tdsk/domain'

import { JinaWebProvider } from './jinaWebProvider'

export const createWebProvider = (config?: TWebProviderConfig): IWebProvider => {
  const resolvedType = config?.type ?? `jina`
  const opts = config?.apiKey ? { apiKey: config?.apiKey } : {}

  switch (resolvedType) {
    case `jina`:
      return new JinaWebProvider(opts)
    default:
      throw new Error(`Unknown web provider: ${resolvedType}`)
  }
}
