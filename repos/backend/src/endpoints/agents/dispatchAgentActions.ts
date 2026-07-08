import type { Response } from 'express'
import type { TReqHandler } from '@tdsk/domain'
import type { TInvokeResult } from '@TBE/utils/agent/invokeAction'
import type { TEndpointBuilder, TRequest } from '@TBE/types'

import express from 'express'
import { EPMethod } from '@TBE/types'
import { isObj } from '@keg-hub/jsutils/isObj'
import { Exception, adminPath } from '@tdsk/domain'
import { residentAuth } from '@TBE/middleware/residentAuth'
import { invokeAction } from '@TBE/utils/agent/invokeAction'
import { resolveResidentAllowlist } from '@TBE/utils/agent/residentAllowlist'

/** Hard cap on actions per dispatch call — residents batch beyond this. */
export const MaxDispatchActions = 20

/**
 * POST /_/orgs/:orgId/projects/:projectId/agents/:agentId/dispatch
 *
 * The resident effect surface: `dispatchActions` with HTTP in front of it.
 * Body `{ actions: TAgentAction[] }` (1..20); each action runs through the
 * existing `invokeAction` core — same server-side allowlist gate (resolved
 * from the agent's resident config via `resolveResidentAllowlist`, NEVER the
 * request), same Function resolution, same `{ agentId }` caller injection.
 * Responds with a per-action `{ ok, data?, error? }` array; one failing
 * action never aborts its siblings.
 *
 * Auth is the resident token (see residentAuth) — which is why this group is
 * registered BEFORE the `accounts` group in endpoints.ts: the accounts-level
 * `authenticate` middleware requires a proxy-forwarded user and would reject
 * the resident principal. The app-level `/_` rate limiter (setupRateLimit)
 * still covers this path.
 */
export const dispatchAgentActions = async (
  req: TRequest,
  res: Response
): Promise<void> => {
  const { db } = req.app.locals
  const { orgId, projectId, agentId } = req.params

  const actions = (req.body as { actions?: unknown })?.actions
  if (!Array.isArray(actions) || !actions.length)
    throw new Exception(400, `actions must be a non-empty array`)
  if (actions.length > MaxDispatchActions)
    throw new Exception(400, `Too many actions — max ${MaxDispatchActions} per dispatch`)

  for (const action of actions) {
    if (!isObj(action) || typeof action.function !== `string` || !action.function.length)
      throw new Exception(400, `Each action requires a function name`)
    if (action.args !== undefined && (!isObj(action.args) || Array.isArray(action.args)))
      throw new Exception(400, `Action args must be an object`)
  }

  const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
  if (agentErr) throw new Exception(500, agentErr.message)
  if (!agent) throw new Exception(404, `Agent not found`)
  if (agent.orgId !== orgId)
    throw new Exception(403, `Agent does not belong to this organization`)
  if (!agent.projects?.some((project) => project.id === projectId))
    throw new Exception(403, `Agent is not bound to this project`)

  const allowlist = await resolveResidentAllowlist(db, agent, projectId)

  // Serialized on purpose — residents emit ordered effects, and invokeAction
  // never throws, so every action gets a result slot.
  const results: TInvokeResult[] = []
  for (const action of actions) {
    results.push(
      await invokeAction(
        req.app,
        db,
        projectId,
        { function: action.function, args: action.args ?? {} },
        allowlist,
        { agentId }
      )
    )
  }

  res.status(200).json({ data: results })
}

/**
 * Top-level registration (sibling of `accounts`, NOT nested under it) so the
 * resident token can authenticate without a proxy-forwarded user. Registered
 * before `accounts`: Express matches this exact POST first, so the
 * accounts-group middleware never intercepts dispatch requests. Carries its
 * own json parser — the accounts-level parser does not apply here.
 */
export const residentDispatch: TEndpointBuilder = (app) => ({
  method: EPMethod.Post,
  path: `${adminPath(app.locals.config.server)}/orgs/:orgId/projects/:projectId/agents/:agentId/dispatch`,
  middleware: [express.json() as unknown as TReqHandler<TRequest>, residentAuth],
  action: dispatchAgentActions,
})
