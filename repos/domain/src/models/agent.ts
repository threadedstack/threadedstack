import type { TAgentEnvVars, TAgentEnvironment } from '@TDM/types'

import { Base } from './base'
import { Secret } from './secret'

export class Agent extends Base {
  name: string
  model?: string
  agentId?: string
  maxTokens?: number
  projectId: string
  providerId: string
  description?: string
  tools: string[] = []
  systemPrompt?: string
  active: boolean = true
  secrets: Secret[] = []
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
    })
  }

  sanitize = () => {
    return new Agent({
      ...this,
      secrets: this.secrets.map((secret) => secret.sanitize()),
    })
  }
}
