import type { Response } from 'express'
import type { TReqHandler } from '@tdsk/domain'
import type { TEndpointBuilder, TRequest } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { residentAuth } from '@TBE/middleware/residentAuth'
import { Exception, adminPath } from '@tdsk/domain'
import { authorAgentFunctionCore } from '@TBE/utils/agent/authorFunction'

/**
 * POST /_/orgs/:orgId/projects/:projectId/agents/:agentId/author-function
 *
 * The self-extension fast path (spec §5.1): a resident submits
 * `{ name, description, language, content }` and the platform manufactures a
 * project-scoped Function from it. A thin HTTP wrapper over the shared
 * `authorAgentFunctionCore` (the same path the scheduled executor's
 * `tdsk-author-function` fence uses), mapping its structured result to a
 * response. Safety (fail-closed scan + project scope + authored-by audit) lives
 * in the core; the wrapper only handles transport + auth (residentAuth).
 */
export const authorAgentFunction = async (
  req: TRequest,
  res: Response
): Promise<void> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params
  const body = (req.body ?? {}) as Record<string, unknown>

  const result = await authorAgentFunctionCore(db, {
    orgId,
    projectId,
    agentId,
    name: typeof body.name === `string` ? body.name : ``,
    content: typeof body.content === `string` ? body.content : ``,
    description: typeof body.description === `string` ? body.description : undefined,
    language: typeof body.language === `string` ? body.language : undefined,
  })

  if (!result.ok) throw new Exception(result.status, result.error)
  res.status(result.status).json({ data: result.fn })
}

/**
 * Top-level registration (sibling of `residentDispatch`, NOT nested under
 * `accounts`) so the resident token can authenticate without a
 * proxy-forwarded user. Registered before `accounts` for the same reason as
 * dispatch, with its own json parser and the same residentAuth gate — the
 * key must be resident-bound to exactly the `:agentId` in the URL.
 */
export const residentAuthorFunction: TEndpointBuilder = (app) => ({
  method: EPMethod.Post,
  path: `${adminPath(app.locals.config.server)}/orgs/:orgId/projects/:projectId/agents/:agentId/author-function`,
  middleware: [express.json() as unknown as TReqHandler<TRequest>, residentAuth],
  action: authorAgentFunction,
})
