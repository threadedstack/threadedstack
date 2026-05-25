import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TPermission } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { ApiKey, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import {
  validateExpiresAt,
  validateApiKeyPermissions,
} from '@TBE/utils/auth/validateApiKey'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'

/**
 * PUT /api-keys/:id - Update an API key
 * Requires admin+ role
 */
export const updateApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.apiKey)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { name, permissions, expiresAt, rateLimit, active } = req.body

    if (expiresAt) {
      const { valid, error } = validateExpiresAt(expiresAt)
      if (!valid || error) throw new Exception(400, error || `Invalid expiration date`)
    }

    // If permissions are being updated, validate against the key OWNER's permissions,
    // not the caller's. Construct a modified request with the owner's userId so
    // resolveEffectivePermissions resolves the correct permission set.
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const { data: existingKey, error: getErr } = await db.services.apiKey.get(id)
      if (getErr) throw new Exception(500, getErr.message)
      if (!existingKey) throw new Exception(404, `API key not found`)

      const ownerReq = {
        ...req,
        user: { ...req.user, id: existingKey.userId },
      } as TRequest
      const ownerPerms = await resolveEffectivePermissions(ownerReq, {
        orgId: existingKey.orgId || req.params.orgId,
        projectId: existingKey.projectId,
      })
      if (ownerPerms !== 'super') {
        const permCheck = validateApiKeyPermissions(
          permissions as TPermission[],
          ownerPerms
        )
        if (!permCheck.valid) throw new Exception(403, permCheck.error)
      }
    }

    try {
      const update = new ApiKey({ id })

      if (name !== undefined) update.name = name
      if (permissions !== undefined) update.permissions = permissions
      if (active !== undefined) update.active = active
      if (rateLimit !== undefined) update.rateLimit = Number.parseInt(rateLimit, 10)
      if (expiresAt !== undefined)
        update.expiresAt = expiresAt ? new Date(expiresAt) : null

      const { data, error } = await db.services.apiKey.update(update)

      if (error) throw new Exception(500, error.message)

      res.status(200).json({ data: data.sanitize() })
    } catch (err) {
      if (err instanceof Exception) throw err
      const message = err instanceof Error ? err.message : `Failed to update API key`
      throw new Exception(500, message)
    }
  },
}
