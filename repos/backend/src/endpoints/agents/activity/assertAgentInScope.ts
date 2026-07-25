import type { TRequest } from '@TBE/types'

import { Exception } from '@tdsk/domain'

/**
 * Resolve and scope-check the agent BEFORE any collection is read, returning
 * the verified agentId.
 *
 * The activity collections are project-scoped, but their rows are addressed
 * only by an agent field inside the JSON document. Without this check a caller
 * with access to one project could aim an arbitrary agent id at the read. Both
 * the org AND the project binding are verified — the same two checks
 * `residentRecordsQuery` applies — so telemetry for an agent that is not part
 * of the requested project is never returned.
 *
 * Every scope failure is 404 rather than 403: a 403 would confirm that an
 * out-of-scope agent id exists, which is precisely what an id-guessing caller
 * is probing for.
 */
export const assertAgentInScope = async (req: TRequest): Promise<string> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params

  if (!orgId) throw new Exception(400, `orgId is required`)
  if (!projectId) throw new Exception(400, `projectId is required`)
  if (!agentId) throw new Exception(400, `agentId is required`)

  const { data, error } = await db.services.agent.get(agentId)
  if (error) throw new Exception(500, error.message)
  if (!data || data.orgId !== orgId) throw new Exception(404, `Agent not found`)
  if (!data.projects?.some((project) => project.id === projectId))
    throw new Exception(404, `Agent not found`)

  return agentId
}
