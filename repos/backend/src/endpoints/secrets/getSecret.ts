import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'

/**
 * GET /secrets/:id - Get secret by ID
 * Members can see metadata (name, id), admins can see values
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

    // Determine scope from secret's exclusive arc
    const orgId = data.orgId
    const projectId = data.projectId

    // Check if user can see secret values
    const userRole = await getUserRole(req, { orgId, projectId })
    const includeValue = canAccessSecretValue(userRole)

    // Return sanitized for members, full for admins
    const responseData = includeValue ? data : data.sanitize()

    res.status(200).json({ data: responseData })
  },
}
