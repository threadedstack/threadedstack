import type { TAgentEnvVars, TAgentEnvironment } from '@TDM/types'

import { Base } from './base'
import { Secret } from './secret'
import { Project } from './project'
import { Provider } from './provider'
import { Function as FunctionModel } from './function'

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
  functions: FunctionModel[] = []
  environment: TAgentEnvironment = {}

  constructor(agent: Partial<Agent>) {
    super()

    const { secrets, functions, providers, projects, ...rest } = agent

    Object.assign(this, {
      ...rest,
      secrets:
        secrets?.map((secret) =>
          secret instanceof Secret ? secret : new Secret(secret)
        ) || [],
      functions:
        functions?.map((fn) =>
          fn instanceof FunctionModel ? fn : new FunctionModel(fn)
        ) || [],
      projects:
        projects?.map((project) =>
          project instanceof Project ? project : new Project(project)
        ) || [],
      providers:
        providers?.map((prov) =>
          prov instanceof Provider ? prov : new Provider(prov)
        ) || [],
    })
  }

  get primaryProvider(): Provider | undefined {
    return this.providers?.[0]
  }

  sanitize = () => {
    return new Agent({
      ...this,
      secrets: this.secrets.map((secret) => secret.sanitize()),
    })
  }
}
