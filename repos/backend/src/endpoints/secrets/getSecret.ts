import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TPermission } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'

/**
 * GET /secrets/:id - Get secret by ID
 * Members can see metadata (name, id), admins can see values (secret:manage)
 */
export const getSecret: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.secret)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data, error } = await db.services.secret.get(id)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Secret not found`)

    // Use override-aware permission resolution to check secret:manage
    // This respects both role-based permissions and per-user overrides
    const orgId = data.orgId
    const projectId = data.projectId
    const permissions = await resolveEffectivePermissions(req, { orgId, projectId })
    const managePermission: TPermission = `${EPermResource.secret}:${EPermAction.manage}`
    const includeValue = permissions === 'super' || permissions.has(managePermission)

    // Return sanitized for members, full for admins
    const responseData = includeValue ? data : data.sanitize()

    res.status(200).json({ data: responseData })
  },
}
