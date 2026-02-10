import type { TAgentEnvVars, TAgentEnvironment } from '@TDM/types'

import { Base } from './base'
import { Secret } from './secret'
import { Project } from './project'
import { Provider } from './provider'

export class Agent extends Base {
  name: string
  model?: string
  maxTokens?: number
  orgId: string
  providerId: string
  provider?: Provider
  description?: string
  tools: string[] = []
  systemPrompt?: string
  active: boolean = true
  secrets: Secret[] = []
  projects: Project[] = []
  envVars: TAgentEnvVars = {}
  environment: TAgentEnvironment = {}

  constructor(agent: Partial<Agent>) {
    super()

    const { secrets, provider, projects, ...rest } = agent

    Object.assign(this, {
      ...rest,
      provider: provider
        ? provider instanceof Provider
          ? provider
          : new Provider(provider)
        : undefined,
      secrets:
        secrets?.map((secret) =>
          secret instanceof Secret ? secret : new Secret(secret)
        ) || [],
      projects:
        projects?.map((project) =>
          project instanceof Project ? project : new Project(project)
        ) || [],
    })
  }

  sanitize = () => {
    return new Agent({
      ...this,
      secrets: this.secrets.map((secret) => secret.sanitize()),
    })
  }
}
