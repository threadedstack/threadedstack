export type TProviderStepData = {
  apiKey: string
  model: string
  providerUrl: string
  providerName: string
  providerTemp: string
}

export type TAgentStepData = {
  projectName: string
  agentName: string
  agentDescription: string
  systemPrompt: string
}

export type TReviewStep = {
  provider: TProviderStepData
  agent: TAgentStepData
}
