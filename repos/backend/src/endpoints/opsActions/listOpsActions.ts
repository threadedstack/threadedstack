import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource, EOpsActionStatus } from '@tdsk/domain'
import { parseStatusFilter } from '@TBE/utils/validation/parseStatusFilter'

const ValidStatuses = new Set(Object.values(EOpsActionStatus))

/**
 * GET /:orgId/ops-actions - List ops actions for an org.
 * Optional ?status= (proposed|dryRun|rejected|executed|failed) and ?agentId= filters.
 */
export const listOpsActions: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.opsAction)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    const status = parseStatusFilter(req.query.status, ValidStatuses)

    const where: Record<string, string> = { orgId }
    if (status) where.status = status
    if (typeof req.query.agentId === `string`) where.agentId = req.query.agentId

    const { data, error } = await db.services.opsAction.list({ where })
    if (error) throw new Exception(500, error.message)

    res.json({ data: data || [] })
  },
}
