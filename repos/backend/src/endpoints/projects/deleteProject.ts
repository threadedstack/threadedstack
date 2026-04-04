import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /Projects/:id - Delete an Project
 * User must be an admin of the organization to delete projects
 */
export const deleteProject: TEndpointConfig = {
  path: `/:projectId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { projectId } = req.params
    const { db } = req.app.locals

    // First get the project to find its orgId
    const { data: existing, error: getError } = await db.services.project.get(projectId)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Project not found`)

    // Check permission - user must be admin of org to delete project
    await checkPermission(req, EPermAction.delete, EPermResource.project, {
      orgId: existing.orgId,
    })

    // Delete the project
    const { data, error } = await db.services.project.delete(projectId)
    if (error) throw new Exception(500, error.message)

    // Decrement project quota for the org
    if (existing.orgId && db.services.quota) {
      db.services.quota
        .decrement(existing.orgId, getBillingPeriod(), `projects`)
        .catch((err: unknown) =>
          logger.error(
            `[quota] Failed to decrement projects for org=${existing.orgId}:`,
            err
          )
        )
    }

    res.status(200).json({ data: { success: true, id: projectId } })
  },
}
