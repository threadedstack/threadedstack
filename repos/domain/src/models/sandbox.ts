import type { Provider } from '@TDM/models/provider'
import type { TProviderLink, TKubeSandboxConfig, TSandboxProjectConfig } from '@TDM/types'

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
  projectConfigs: TSandboxProjectConfig[] = []

  constructor(data: TSandboxData) {
    super()

    const { projects, providerLinks, projectConfigs, ...rest } = data

    Object.assign(this, {
      ...rest,
      projects:
        projects?.map((project) =>
          project instanceof Project ? project : new Project(project)
        ) || [],
      providerLinks: toProviderLinks(providerLinks),
      projectConfigs: projectConfigs || [],
    })
  }

  get providers(): Provider[] {
    return this.providerLinks.map((l) => l.provider)
  }

  get primaryProvider(): Provider | undefined {
    return this.providerLinks[0]?.provider
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

    return new Sandbox({
      ...this,
      ...(pc.alias != null && { name: pc.alias }),
      projects: this.projects,
      projectConfigs: this.projectConfigs,
      providerLinks: this.providerLinks,
      ...(overrideConfig
        ? {
            config: {
              ...this.config,
              ...overrideConfig,
              envVars: { ...this.config.envVars, ...(overrideConfig.envVars || {}) },
              resources: {
                limits: {
                  ...this.config.resources?.limits,
                  ...overrideConfig.resources?.limits,
                },
                requests: {
                  ...this.config.resources?.requests,
                  ...overrideConfig.resources?.requests,
                },
              },
              ports: { ...this.config.ports, ...(overrideConfig.ports || {}) },
              sync: { ...this.config.sync, ...(overrideConfig.sync || {}) },
            },
          }
        : {}),
    })
  }
}
