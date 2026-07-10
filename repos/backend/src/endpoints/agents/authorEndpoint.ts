import type { Response } from 'express'
import type { TReqHandler } from '@tdsk/domain'
import type { TEndpointBuilder, TRequest } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { residentAuth } from '@TBE/middleware/residentAuth'
import { Exception, adminPath } from '@tdsk/domain'
import { authorAgentEndpointCore } from '@TBE/utils/agent/authorEndpoint'

/**
 * POST /_/orgs/:orgId/projects/:projectId/agents/:agentId/author-endpoint
 *
 * The self-extension fast path for proxy Endpoints: a resident submits
 * `{ name, path, type?, options, headers?, description? }` and the platform
 * manufactures a project-scoped proxy Endpoint from it. A thin HTTP wrapper over
 * the shared `authorAgentEndpointCore` (the same path the scheduled executor's
 * `tdsk-author-endpoint` fence uses), mapping its structured result to a
 * response. Safety (proxy-only + SSRF egress guard + injectSecrets refusal +
 * same-agent secret ownership + fail-closed scan + project scope + authored-by
 * audit) lives in the core; the wrapper only handles transport + auth
 * (residentAuth).
 */
export const authorAgentEndpoint = async (
  req: TRequest,
  res: Response
): Promise<void> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params
  const body = (req.body ?? {}) as Record<string, unknown>

  const result = await authorAgentEndpointCore(db, {
    orgId,
    projectId,
    agentId,
    name: typeof body.name === `string` ? body.name : ``,
    path: typeof body.path === `string` ? body.path : ``,
    options:
      body.options && typeof body.options === `object` && !Array.isArray(body.options)
        ? (body.options as Record<string, unknown>)
        : {},
    headers:
      body.headers && typeof body.headers === `object` && !Array.isArray(body.headers)
        ? (body.headers as Record<string, string>)
        : undefined,
    description: typeof body.description === `string` ? body.description : undefined,
    type: typeof body.type === `string` ? body.type : undefined,
  })

  if (!result.ok) throw new Exception(result.status, result.error)
  res.status(result.status).json({ data: result.endpoint })
}

/**
 * Top-level registration (sibling of `residentAuthorFunction`, NOT nested under
 * `accounts`) so the resident token can authenticate without a
 * proxy-forwarded user. Registered before `accounts` for the same reason as
 * dispatch, with its own json parser and the same residentAuth gate — the
 * key must be resident-bound to exactly the `:agentId` in the URL.
 */
export const residentAuthorEndpoint: TEndpointBuilder = (app) => ({
  method: EPMethod.Post,
  path: `${adminPath(app.locals.config.server)}/orgs/:orgId/projects/:projectId/agents/:agentId/author-endpoint`,
  middleware: [express.json() as unknown as TReqHandler<TRequest>, residentAuth],
  action: authorAgentEndpoint,
})
