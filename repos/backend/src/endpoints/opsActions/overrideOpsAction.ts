import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { applyOpsReview, revertOpsAction } from '@TBE/utils/agent/opsPromotion'
import { Exception, EPermAction, EPermResource, EOpsActionStatus } from '@tdsk/domain'

const TerminalStatuses = new Set([EOpsActionStatus.rejected, EOpsActionStatus.failed])

/**
 * POST /:orgId/ops-actions/:opsActionId/override - Async admin override.
 *
 * Body: { approve: boolean, reason?: string }
 *
 * Behavior by row status:
 *   - dryRun|proposed + approve=true  → applyOpsReview(approve:true) → executes
 *   - dryRun|proposed + approve=false → applyOpsReview(approve:false) → rejected
 *   - executed + approve=false        → revertOpsAction(opsActionId)
 *   - executed + approve=true         → 400 (already executed)
 *   - rejected|failed                 → 409 (terminal, no override)
 *
 * Nothing in the steward loop waits on this — it is purely an async human safety net.
 */
export const overrideOpsAction: TEndpointConfig = {
  path: `/:opsActionId/override`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.update, EPermResource.opsAction)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const app = req.app
    const { orgId, opsActionId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!opsActionId) throw new Exception(400, `opsActionId is required`)

    const { approve, reason } = req.body
    if (typeof approve !== `boolean`)
      throw new Exception(400, `approve must be a boolean`)
    if (reason !== undefined && typeof reason !== `string`)
      throw new Exception(400, `reason must be a string`)

    const { data: row, error } = await db.services.opsAction.get(opsActionId)
    if (error) throw new Exception(500, error.message)
    if (!row || row.orgId !== orgId) throw new Exception(404, `Ops action not found`)

    // Terminal: no override applicable
    if (TerminalStatuses.has(row.status as any))
      throw new Exception(
        409,
        `Ops action is terminal (status=${row.status}); no override applicable`
      )

    // Already executed + approve=true: nothing to approve
    if (row.status === EOpsActionStatus.executed && approve === true)
      throw new Exception(400, `Ops action is already executed; nothing to approve`)

    // Already executed + approve=false: revert
    if (row.status === EOpsActionStatus.executed && approve === false) {
      const revertResult = await revertOpsAction(app, db, opsActionId)
      res.json({
        data: revertResult,
        note: `Executed row reverted via captured rollback data. See D8 for rollback semantics per action.`,
      })
      return
    }

    // dryRun or proposed: apply review
    const result = await applyOpsReview(
      app,
      db,
      orgId,
      { opsActionId, approve, reason },
      req.user?.id
    )

    if (result === null)
      throw new Exception(
        409,
        `Ops action could not be reviewed (already terminal or not found)`
      )

    // Fetch the updated row for the response
    const { data: updatedRow } = await db.services.opsAction.get(opsActionId)

    res.json({
      data: updatedRow,
      note: `Async override applied. Adversary ops-review cycle is the default gate; this is a human safety net.`,
    })
  },
}
