import type {
  TProviderLink,
  TAgentEnvVars,
  TAgentEnvironment,
  TAgentProjectConfig,
} from '@TDM/types'

import { Base } from '@TDM/models/base'
import { Secret } from '@TDM/models/secret'
import { Project } from '@TDM/models/project'
import type { Provider } from '@TDM/models/provider'
import { toProviderLinks } from '@TDM/utils/providers/toProviderLinks'

export class Agent extends Base {
  name: string
  orgId: string
  model?: string
  maxTokens?: number
  description?: string
  tools: string[] = []
  systemPrompt?: string
  soul?: string
  active: boolean = true
  autonomous: boolean = false
  secrets: Secret[] = []
  projects: Project[] = []
  envVars: TAgentEnvVars = {}
  providerLinks: TProviderLink[] = []
  environment: TAgentEnvironment = {}
  projectConfigs: TAgentProjectConfig[] = []

  constructor(agent: Partial<Agent>) {
    super()

    const { secrets, projects, providerLinks, projectConfigs, ...rest } = agent

    Object.assign(this, {
      ...rest,
      secrets:
        secrets?.map((secret) =>
          secret instanceof Secret ? secret : new Secret(secret)
        ) || [],
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

  getProjectConfig(projectId: string): TAgentProjectConfig | undefined {
    return this.projectConfigs?.find((c) => c.projectId === projectId)
  }

  resolveModel(providerId: string, providerDefaultModel?: string): string | undefined {
    const link = this.providerLinks?.find((l) => l.provider.id === providerId)
    return link?.model ?? this.model ?? providerDefaultModel ?? undefined
  }

  getEffectiveConfig(projectId?: string): Agent {
    if (!projectId) return this
    const config = this.getProjectConfig(projectId)
    if (!config) return this

    return new Agent({
      ...this,
      model: config.model ?? this.model,
      tools: config.tools ?? this.tools,
      projectConfigs: this.projectConfigs,
      providerLinks: this.providerLinks,
      maxTokens: config.maxTokens ?? this.maxTokens,
      systemPrompt: config.systemPrompt ?? this.systemPrompt,
      envVars: { ...this.envVars, ...(config.envVars || {}) },
      environment: { ...this.environment, ...(config.environment || {}) },
    })
  }

  sanitize() {
    return new Agent({
      ...this,
      providerLinks: this.providerLinks,
      secrets: this.secrets.map((secret) => secret.sanitize()),
    })
  }
}
