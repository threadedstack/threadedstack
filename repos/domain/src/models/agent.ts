import type {
  TAgentEnvVars,
  TAgentProvider,
  TAgentEnvironment,
  TAgentProjectConfig,
} from '@TDM/types'

import { Base } from './base'
import { Secret } from './secret'
import { Project } from './project'
import { Provider } from './provider'

export class Agent extends Base {
  name: string
  orgId: string
  model?: string
  maxTokens?: number
  description?: string
  tools: string[] = []
  systemPrompt?: string
  active: boolean = true
  secrets: Secret[] = []
  projects: Project[] = []
  providers: Provider[] = []
  envVars: TAgentEnvVars = {}
  providerPriorities: number[] = []
  environment: TAgentEnvironment = {}
  projectConfigs: TAgentProjectConfig[] = []

  constructor(agent: Partial<Agent>) {
    super()

    // biome-ignore format: None
    const {
      secrets,
      projects,
      providers,
      projectConfigs,
      providerPriorities,
      ...rest
    } = agent

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
      providers:
        providers?.map((prov) =>
          prov instanceof Provider ? prov : new Provider(prov)
        ) || [],
      providerPriorities: providerPriorities || [],
      projectConfigs: projectConfigs || [],
    })
  }

  get primaryProvider(): Provider | undefined {
    return this.providers?.[0]
  }

  /**
   * Returns providers with their priority metadata.
   * If providerPriorities is empty, defaults priority to the array index.
   */
  get agentProviders(): TAgentProvider[] {
    return this.providers.map((provider, index) => ({
      provider,
      priority: this.providerPriorities[index] ?? index,
    }))
  }

  /**
   * Get the project config for a specific project
   */
  getProjectConfig(projectId: string): TAgentProjectConfig | undefined {
    return this.projectConfigs?.find((c) => c.projectId === projectId)
  }

  /**
   * Get the effective agent config for a specific project context.
   * Merges base agent config with project-level overrides.
   * NULL override fields = inherit from base agent.
   * envVars and environment are deep merged (project keys win).
   * Returns a new Agent instance with merged config.
   */
  getEffectiveConfig(projectId?: string): Agent {
    if (!projectId) return this
    const config = this.getProjectConfig(projectId)
    if (!config) return this

    return new Agent({
      ...this,
      model: config.model ?? this.model,
      tools: config.tools ?? this.tools,
      projectConfigs: this.projectConfigs,
      maxTokens: config.maxTokens ?? this.maxTokens,
      systemPrompt: config.systemPrompt ?? this.systemPrompt,
      envVars: { ...this.envVars, ...(config.envVars || {}) },
      environment: { ...this.environment, ...(config.environment || {}) },
    })
  }

  sanitize() {
    return new Agent({
      ...this,
      secrets: this.secrets.map((secret) => secret.sanitize()),
    })
  }
}
