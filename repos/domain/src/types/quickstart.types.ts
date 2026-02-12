/**
 * Provider model entry for template definitions
 */
export type TProviderModel = {
  id: string
  name: string
  maxTokens: number
  description?: string
}

/**
 * Provider template definition for quickstart wizard
 */
export type TProviderTemplate = {
  id: string
  name: string
  baseUrl: string
  defaultModel: string
  defaultSecretName: string
  apiKeyPlaceholder: string
  apiKeyPattern?: string
  models: TProviderModel[]
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
  /** Provider template ID (e.g., 'anthropic', 'openai', 'google', 'custom') */
  providerTemp: string
  /** Custom provider fields (required when template = 'custom') */
  providerUrl?: string
  providerName?: string
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
