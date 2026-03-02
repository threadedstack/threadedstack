import type { TLLMProviderBrand, TModelCost } from '@TDM/types/ai.types'

/**
 * Provider model entry — enriched with pi-mono metadata.
 * Only `id` and `name` are required; the rest come from pi-mono's registry.
 */
export type TProviderModel = {
  id: string
  name: string
  maxTokens?: number
  description?: string
  contextWindow?: number
  reasoning?: boolean
  cost?: TModelCost
  inputTypes?: string[]
}

/**
 * Provider template definition for quickstart wizard.
 * Models are now sourced from pi-mono's registry (via backend endpoint),
 * NOT from hardcoded arrays.
 */
export type TProviderTemplate = {
  name: string
  baseUrl: string
  id: TLLMProviderBrand
  apiKeyPattern?: string
  defaultSecretName: string
  apiKeyPlaceholder: string
}

/**
 * Request payload for the quickstart endpoint
 * Creates Provider + Secret + Project + Agent + Endpoint in one transaction
 */
export type TQuickstartRequest = {
  /** API key for the AI provider */
  apiKey: string
  /** Project name */
  projectName: string
  /** Agent name */
  agentName: string
  /** Agent description (optional) */
  agentDescription?: string
  /** Model override (defaults to template default) */
  model?: string
  /** Max tokens override (defaults to template model's maxTokens) */
  maxTokens?: number
  /** System prompt (optional) */
  systemPrompt?: string
  /** Custom provider fields (required when template = 'custom') */
  providerUrl?: string
  providerName?: string
  /** Provider template ID (e.g., 'anthropic', 'openai', 'google', 'custom') */
  providerBrand: TLLMProviderBrand
}

/**
 * Response from the quickstart endpoint
 * Contains all 5 created resources
 */
export type TQuickstartResponse = {
  provider: Record<string, any>
  secret: Record<string, any>
  project: Record<string, any>
  agent: Record<string, any>
  endpoint: Record<string, any>
}
