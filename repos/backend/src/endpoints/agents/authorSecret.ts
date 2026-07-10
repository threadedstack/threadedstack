import type { Response } from 'express'
import type { TReqHandler } from '@tdsk/domain'
import type { TEndpointBuilder, TRequest } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { residentAuth } from '@TBE/middleware/residentAuth'
import { Exception, adminPath } from '@tdsk/domain'
import { authorAgentSecretCore } from '@TBE/utils/agent/authorSecret'

/**
 * POST /_/orgs/:orgId/projects/:projectId/agents/:agentId/author-secret
 *
 * The self-credential fast path: a resident submits `{ name, value, description }`
 * for a credential IT OBTAINED (e.g. an API key from signing up for a service)
 * and the platform stores it as the agent's OWN encrypted Secret. A thin HTTP
 * wrapper over the shared `authorAgentSecretCore` (the same path the scheduled
 * executor's `tdsk-author-secret` fence uses), mapping its structured result to
 * a response.
 *
 * SECURITY: the request `value` is encrypted at rest and the response echoes
 * ONLY `{ secretId, name, rotated }` — the value is never scanned, never logged,
 * and never returned. Safety (name/description-only scan + agent scope +
 * agent-ownership authorship marker) lives in the core; the wrapper only handles
 * transport + auth (residentAuth).
 */
export const authorAgentSecret = async (req: TRequest, res: Response): Promise<void> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params
  const body = (req.body ?? {}) as Record<string, unknown>

  const result = await authorAgentSecretCore(db, {
    orgId,
    projectId,
    agentId,
    name: typeof body.name === `string` ? body.name : ``,
    value: typeof body.value === `string` ? body.value : ``,
    description: typeof body.description === `string` ? body.description : undefined,
  })

  if (!result.ok) throw new Exception(result.status, result.error)
  // NEVER echo the secret value — only its id, name, and whether it rotated.
  res.status(result.status).json({
    data: { secretId: result.secretId, name: result.name, rotated: result.rotated },
  })
}

/**
 * Top-level registration (sibling of `residentAuthorFunction`, NOT nested under
 * `accounts`) so the resident token can authenticate without a proxy-forwarded
 * user. Registered before `accounts` for the same reason, with its own json
 * parser and the same residentAuth gate — the key must be resident-bound to
 * exactly the `:agentId` in the URL.
 */
export const residentAuthorSecret: TEndpointBuilder = (app) => ({
  method: EPMethod.Post,
  path: `${adminPath(app.locals.config.server)}/orgs/:orgId/projects/:projectId/agents/:agentId/author-secret`,
  middleware: [express.json() as unknown as TReqHandler<TRequest>, residentAuth],
  action: authorAgentSecret,
})
