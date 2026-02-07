import type { TAgentEnvVars, TAgentEnvironment } from '@TDM/types'

import { Base } from './base'
import { Secret } from './secret'
import { Project } from './project'

export class Agent extends Base {
  name: string
  model?: string
  agentId?: string
  maxTokens?: number
  orgId: string
  providerId: string
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
    Object.assign(this, {
      ...agent,
      // Map secrets array to instantiate Secret objects
      secrets:
        agent?.secrets?.map((secret) =>
          secret instanceof Secret ? secret : new Secret(secret)
        ) || [],
      // Map projects array to instantiate Project objects
      projects:
        agent?.projects?.map((project) =>
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
