import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:orgId/overrides/:id - Delete a permission override
 * Requires role:manage permission (admin+)
 */
export const deleteOverride: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.manage, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id, orgId } = req.params

    if (!id) throw new Exception(400, `Override id is required`)

    // Fetch the override first to verify it belongs to the caller's org
    const { data: existing, error: fetchErr } =
      await db.services.permissionOverride.get(id)
    if (fetchErr)
      throw new Exception(500, `Failed to fetch override: ${fetchErr.message}`)
    if (!existing) throw new Exception(404, `Permission override not found`)

    if (existing.orgId) {
      if (existing.orgId !== orgId)
        throw new Exception(
          403,
          `Override does not belong to this organization`,
          `FORBIDDEN`
        )
    } else if (existing.projectId) {
      const { data: project, error: projErr } = await db.services.project.get(
        existing.projectId
      )
      if (projErr)
        throw new Exception(500, `Failed to verify project ownership: ${projErr.message}`)
      if (!project || project.orgId !== orgId)
        throw new Exception(
          403,
          `Override does not belong to this organization`,
          `FORBIDDEN`
        )
    }

    const { data: deleted, error } = await db.services.permissionOverride.deleteById(id)
    if (error) throw new Exception(500, error.message)
    if (!deleted) throw new Exception(404, `Permission override not found`)

    res.status(200).json({ data: { success: true, id } })
  },
}
