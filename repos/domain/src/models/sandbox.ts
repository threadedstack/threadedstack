import type { TProviderLink, TKubeSandboxConfig } from '@TDM/types'

import { Base } from '@TDM/models/base'
import type { Provider } from '@TDM/models/provider'
import { toProviderLinks } from '@TDM/utils/providers/toProviderLinks'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  projectId?: string
  builtIn: boolean = false
  config: TKubeSandboxConfig
  providerLinks: TProviderLink[] = []

  constructor(data: TSandboxData) {
    super()

    const { providerLinks, ...rest } = data

    Object.assign(this, {
      ...rest,
      providerLinks: toProviderLinks(providerLinks),
    })
  }

  get providers(): Provider[] {
    return this.providerLinks.map((l) => l.provider)
  }

  get primaryProvider(): Provider | undefined {
    return this.providerLinks[0]?.provider
  }
}
