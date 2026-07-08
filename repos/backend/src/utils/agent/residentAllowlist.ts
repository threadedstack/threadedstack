import type { Agent } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

import { EQueryOp } from '@tdsk/domain'

/** The per-project collection holding one config record per resident agent. */
export const ResidentConfigsCollection = `resident_configs`

/**
 * The resident dispatch allowlist seam. The dispatch endpoint NEVER trusts a
 * client-supplied allowlist — it resolves the agent's allowed Function names
 * server-side through this single function: the `actions` array on the
 * agent's `resident_configs` record in the dispatch project (R3 — the R1
 * agent-environment fallback is gone). No record, no project, or no `actions`
 * array resolves to an EMPTY allowlist — fail closed, every action rejected.
 */
export const resolveResidentAllowlist = async (
  db: TDatabase,
  agent: Agent,
  projectId?: string
): Promise<string[]> => {
  if (!projectId) return []

  const { data, error } = await db.services.record.query(
    projectId,
    ResidentConfigsCollection,
    {
      where: [{ field: `agentId`, op: EQueryOp.eq, value: agent.id }],
      limit: 1,
    }
  )
  if (error || !data?.length) return []

  const actions = (data[0].data as Record<string, unknown>)?.actions
  return Array.isArray(actions)
    ? actions.filter((action): action is string => typeof action === `string`)
    : []
}
