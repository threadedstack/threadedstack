import type { Agent } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

/**
 * The resident dispatch allowlist seam. The dispatch endpoint NEVER trusts a
 * client-supplied allowlist — it resolves the agent's allowed Function names
 * server-side through this single function. R1 reads `residentActions` from
 * the agent's effective environment (the agent row's `environment`, merged
 * with any agent_projects override for the project); R3 repoints this
 * resolver at the `resident_configs` collection (hence the db + projectId
 * params) without touching the endpoint.
 */
export const resolveResidentAllowlist = async (
  _db: TDatabase,
  agent: Agent,
  projectId?: string
): Promise<string[]> => {
  const effective = projectId ? agent.getEffectiveConfig(projectId) : agent
  return effective.environment?.residentActions ?? []
}
