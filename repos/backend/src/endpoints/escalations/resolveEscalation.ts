import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveEscalation as resolveEscalationUtil } from '@TBE/utils/agent/escalationPromotion'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

const ValidResolutionStatuses = new Set([`resolved`, `rejected`])

/**
 * POST /:orgId/escalations/:escalationId/resolve - Async admin override: mark an
 * escalation resolved or rejected. Nothing in the steward loop waits on this;
 * it is a human/admin async veto surface (P4b). Gated by the `escalation` flag.
 */
export const resolveEscalation: TEndpointConfig = {
  path: `/:escalationId/resolve`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.update, EPermResource.escalation)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, escalationId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!escalationId) throw new Exception(400, `escalationId is required`)

    const { status, resolvedRef, reason } = req.body
    if (!status || !ValidResolutionStatuses.has(status))
      throw new Exception(400, `status must be "resolved" or "rejected"`)
    if (resolvedRef !== undefined && typeof resolvedRef !== `string`)
      throw new Exception(400, `resolvedRef must be a string`)
    if (reason !== undefined && typeof reason !== `string`)
      throw new Exception(400, `reason must be a string`)

    const { data: esc, error } = await db.services.escalation.get(escalationId)
    if (error) throw new Exception(500, error.message)
    if (!esc || esc.orgId !== orgId) throw new Exception(404, `Escalation not found`)

    const result = await resolveEscalationUtil(
      db,
      orgId,
      { id: escalationId, status, resolvedRef, reason },
      req.user?.id
    )

    if (result === null)
      throw new Exception(
        409,
        `Escalation is already in a terminal state and cannot be updated`
      )

    const { data: updated } = await db.services.escalation.get(escalationId)
    res.json({ data: updated })
  },
}
