import type { Provider } from '@TDM/models'

/**
 * Agent-Provider relationship with priority.
 * Priority 0 = primary provider, 1+ = fallback providers.
 * Stored in agentProviders junction table.
 */
export type TAgentProvider = {
  provider: Provider
  priority: number
}
