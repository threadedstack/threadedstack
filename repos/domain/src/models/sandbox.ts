import type { Provider } from '@TDM/models/provider'
import type {
  TProviderLink,
  TGitProviderLink,
  TKubeSandboxConfig,
  TSandboxProjectConfig,
} from '@TDM/types'

import { Base } from '@TDM/models/base'
import { Project } from '@TDM/models/project'
import { toProviderLinks } from '@TDM/utils/providers/toProviderLinks'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  builtIn: boolean = false
  projects: Project[] = []
  config: TKubeSandboxConfig
  providerLinks: TProviderLink[] = []
  gitProviderLinks: TGitProviderLink[] = []
  projectConfigs: TSandboxProjectConfig[] = []

  constructor(data: TSandboxData) {
    super()

    const { projects, providerLinks, projectConfigs, gitProviderLinks, ...rest } = data

    Object.assign(this, {
      ...rest,
      projectConfigs: projectConfigs || [],
      gitProviderLinks: gitProviderLinks || [],
      providerLinks: toProviderLinks(providerLinks),
      projects:
        projects?.map((project) =>
          project instanceof Project ? project : new Project(project)
        ) || [],
    })
  }

  get providers(): Provider[] {
    return this.providerLinks.map((l) => l.provider)
  }

  get primaryProvider(): Provider | undefined {
    return this.providerLinks[0]?.provider
  }

  getGitProviders(projectId: string): TGitProviderLink[] {
    return this.gitProviderLinks.filter((l) => l.projectId === projectId)
  }

  getProjectConfig(projectId: string): TSandboxProjectConfig | undefined {
    return this.projectConfigs?.find((c) => c.projectId === projectId)
  }

  getProjectAlias(projectId: string): string | undefined {
    return this.getProjectConfig(projectId)?.alias
  }

  getEffectiveConfig(projectId?: string): Sandbox {
    if (!projectId) return this
    const pc = this.getProjectConfig(projectId)
    if (!pc) return this

    const overrideConfig = pc.config
    const base = this.config || ({} as TKubeSandboxConfig)

    return new Sandbox({
      ...this,
      ...(pc.alias != null && { name: pc.alias }),
      projects: this.projects,
      providerLinks: this.providerLinks,
      projectConfigs: this.projectConfigs,
      gitProviderLinks: this.gitProviderLinks,
      ...(overrideConfig
        ? {
            config: {
              ...base,
              ...overrideConfig,
              envVars: { ...base.envVars, ...(overrideConfig.envVars || {}) },
              resources: {
                limits: {
                  ...base.resources?.limits,
                  ...overrideConfig.resources?.limits,
                },
                requests: {
                  ...base.resources?.requests,
                  ...overrideConfig.resources?.requests,
                },
              },
              sync: { ...base.sync, ...(overrideConfig.sync || {}) },
              ports: { ...base.ports, ...(overrideConfig.ports || {}) },
            },
          }
        : {}),
    })
  }
}
