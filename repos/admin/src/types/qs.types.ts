import type { TLLMProviderBrand } from '@tdsk/domain'

export type TProviderStepData = {
  apiKey: string
  model: string
  providerUrl: string
  providerName: string
  providerBrand: TLLMProviderBrand
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
