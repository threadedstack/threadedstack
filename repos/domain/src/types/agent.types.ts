import type { TAgentEnvVars, TAgentEnvironment } from './ai.types'

/**
 * Per-project agent configuration overrides.
 * Stored on the agentProjects junction table.
 * NULL fields = inherit from base agent config.
 */
export type TAgentProjectConfig = {
  agentId: string
  projectId: string
  enabled?: boolean
  alias?: string | null
  model?: string | null
  maxTokens?: number | null
  systemPrompt?: string | null
  tools?: string[] | null
  functionIds?: string[] | null
  envVars?: TAgentEnvVars | null
  environment?: TAgentEnvironment | null
}
