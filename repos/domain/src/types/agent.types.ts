import type { Provider } from '@TDM/models'
import type { TAgentEnvVars, TAgentEnvironment } from './ai.types'

/**
 * Agent-Provider relationship with priority.
 * Priority 0 = primary provider, 1+ = fallback providers.
 * Stored in agentProviders junction table.
 */
export type TAgentProvider = {
  provider: Provider
  priority: number
}

/**
 * Per-project agent configuration overrides.
 * Stored on the agentProjects junction table.
 * NULL fields = inherit from base agent config.
 */
export type TAgentProjectConfig = {
  agentId: string
  projectId: string
  alias?: string | null
  model?: string | null
  maxTokens?: number | null
  systemPrompt?: string | null
  tools?: string[] | null
  functionIds?: string[] | null
  envVars?: TAgentEnvVars | null
  environment?: TAgentEnvironment | null
  enabled?: boolean
}
