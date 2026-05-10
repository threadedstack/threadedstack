import type { Provider } from '@TDM/models/provider'
import type { TProviderLink } from '@TDM/types/provider.types'

import { Base } from '@TDM/models/base'
import { EProvider } from '@TDM/types/provider.types'

type TProjectCounts = {
  agent?: number
  endpoint?: number
  function?: number
}

export class Project extends Base {
  name: string
  orgId: string
  description?: string
  counts?: TProjectCounts
  meta: Record<string, any> = {}
  providerLinks: TProviderLink[] = []

  constructor(project: Partial<Project>) {
    super()
    Object.assign(this, project)
  }

  get providers(): Provider[] {
    return this.providerLinks.map((l) => l.provider)
  }

  get gitProviders(): Provider[] {
    return this.providers.filter((p) => p.type === EProvider.git)
  }

  get primaryGitProvider(): Provider | undefined {
    return this.gitProviders[0]
  }

  get gitUrl(): string | undefined {
    return this.primaryGitProvider?.options?.repoUrl as string | undefined
  }

  get branch(): string {
    return (this.primaryGitProvider?.options?.branch as string) || `main`
  }
}
