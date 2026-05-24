import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { PodLabelKeys } from '@tdsk/sandbox'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource, EContainerState } from '@tdsk/domain'

/**
 * DELETE /orgs/:id - Delete a org
 * Requires owner role in the org
 */
export const deleteOrg: TEndpointConfig = {
  path: `/:orgId`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.org)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db, sandbox: sbService } = req.app.locals

    const { data: existingOrg, error: getError } = await db.services.org.get(orgId)
    if (getError) throw new Exception(500, getError.message)
    if (!existingOrg) throw new Exception(404, `Org not found`)

    if (sbService) {
      const pods = await sbService.listPods({ orgId })
      const activeInstances = pods
        .filter((p) => {
          const phase = p.status?.phase
          return (
            !p.metadata?.deletionTimestamp &&
            (phase === EContainerState.Running || phase === EContainerState.Pending)
          )
        })
        .map((p) => ({
          name: p.metadata?.name,
          sandboxId: p.metadata?.labels?.[PodLabelKeys.sandboxId],
        }))
        .filter(
          (p): p is { name: string; sandboxId: string } => !!p.name && !!p.sandboxId
        )

      if (activeInstances.length > 0) {
        const results = await Promise.allSettled(
          activeInstances.map((p) => sbService.gracefulStopPod(p.name, p.sandboxId))
        )
        const failures = results.filter(
          (r): r is PromiseRejectedResult => r.status === `rejected`
        )
        if (failures.length > 0) {
          for (let i = 0; i < results.length; i++) {
            const r = results[i]
            if (r.status === `rejected`) {
              logger.error(
                `[deleteOrg] Failed to stop pod ${activeInstances[i].name} for org ${orgId}:`,
                r.reason
              )
            }
          }
        }
      }
    }

    const { data, error } = await db.services.org.delete(orgId)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
