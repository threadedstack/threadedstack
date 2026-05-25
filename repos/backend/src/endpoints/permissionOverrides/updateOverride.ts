import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import type { TPermission } from '@tdsk/domain'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'

/**
 * PATCH /:orgId/overrides/:id - Update a permission override
 * Requires role:manage permission (admin+)
 * Body: { effect?, reason?, expiresAt? }
 */
export const updateOverride: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Patch,
  middleware: [authorize(EPermAction.manage, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id, orgId } = req.params
    const { effect, reason, expiresAt } = req.body

    if (!id) throw new Exception(400, `Override id is required`)

    // Fetch the override to verify it belongs to this org
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

    // Build update fields - only include fields that were explicitly provided
    const fields: Record<string, any> = {}
    if (effect !== undefined) {
      if (!['grant', 'deny'].includes(effect))
        throw new Exception(400, `effect must be "grant" or "deny"`)

      if (effect === 'grant') {
        const callerPerms = await resolveEffectivePermissions(req, { orgId })
        if (
          callerPerms !== 'super' &&
          !callerPerms.has(existing.permission as TPermission)
        ) {
          throw new Exception(
            403,
            `Cannot grant a permission you do not have: ${existing.permission}`,
            `FORBIDDEN`
          )
        }
      }

      fields.effect = effect
    }
    if (reason !== undefined) fields.reason = reason || null
    if (expiresAt !== undefined) fields.expiresAt = expiresAt || null

    if (Object.keys(fields).length === 0) throw new Exception(400, `No fields to update`)

    const { data: updated, error } = await db.services.permissionOverride.update({
      id,
      ...fields,
    })
    if (error) throw new Exception(500, error.message)
    if (!updated) throw new Exception(404, `Permission override not found after update`)

    res.status(200).json({ data: updated })
  },
}
