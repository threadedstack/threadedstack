import type { Response } from 'express'
import type { TReqHandler } from '@tdsk/domain'
import type { TEndpointBuilder, TRequest } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { isObj } from '@keg-hub/jsutils/isObj'
import { Exception, adminPath } from '@tdsk/domain'
import { residentAuth } from '@TBE/middleware/residentAuth'

/**
 * POST /_/orgs/:orgId/projects/:projectId/agents/:agentId/records/query
 *
 * The resident READ surface: project-scoped records queries for the runtime's
 * config load, watches, inbox, and contextSources rendering. Body
 * `{ collection: string, query?: TRecordQuery }` → the ① query compiler
 * (field-whitelisted, parameterized) via `db.services.record.query`, returning
 * `[{ id, data }]`.
 *
 * READ-ONLY by design: resident WRITES flow exclusively through the dispatch
 * Function surface (allowlist-gated, caller-stamped) — no raw record writes.
 * Auth is the resident token (residentAuth), registered as a pre-`accounts`
 * sibling exactly like dispatch: the accounts-level `authenticate` requires a
 * proxy-forwarded user and 401s the resident principal (the live failure this
 * endpoint fixes — the runtime's config load died on the collections API).
 */
export const residentRecordsQueryAction = async (
  req: TRequest,
  res: Response
): Promise<void> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params

  const body = req.body as { collection?: unknown; query?: unknown }
  if (typeof body?.collection !== `string` || !body.collection.length)
    throw new Exception(400, `collection is required`)
  if (body.query !== undefined && (!isObj(body.query) || Array.isArray(body.query)))
    throw new Exception(400, `query must be an object`)

  const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
  if (agentErr) throw new Exception(500, agentErr.message)
  if (!agent) throw new Exception(404, `Agent not found`)
  if (agent.orgId !== orgId)
    throw new Exception(403, `Agent does not belong to this organization`)
  if (!agent.projects?.some((project) => project.id === projectId))
    throw new Exception(403, `Agent is not bound to this project`)

  const { data, error } = await db.services.record.query(
    projectId,
    body.collection,
    (body.query as Record<string, unknown>) ?? {}
  )
  if (error) throw new Exception(400, error.message)

  res.status(200).json({
    data: (data ?? []).map((record) => ({ id: record.id, data: record.data })),
  })
}

/** Pre-`accounts` sibling registration — see dispatchAgentActions for why. */
export const residentRecordsQuery: TEndpointBuilder = (app) => ({
  method: EPMethod.Post,
  path: `${adminPath(app.locals.config.server)}/orgs/:orgId/projects/:projectId/agents/:agentId/records/query`,
  middleware: [express.json() as unknown as TReqHandler<TRequest>, residentAuth],
  action: residentRecordsQueryAction,
})
