import type { IWebProvider } from '@TAG/types'
import type { TWebProviderConfig } from '@tdsk/domain'

import { JinaWebProvider } from './jinaWebProvider'

export const createWebProvider = (config?: TWebProviderConfig): IWebProvider => {
  const type = config?.type ?? `jina`

  switch (type) {
    case `jina`:
      return new JinaWebProvider({ apiKey: config?.apiKey })
    default:
      throw new Error(`Unknown web provider: ${type}`)
  }
}
