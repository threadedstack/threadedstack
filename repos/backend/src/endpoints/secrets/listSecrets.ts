import type { Response } from 'express'
import type { Secret } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission, getUserRole } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'

/**
 * GET /secrets - List all secrets
 * Members can see metadata (name, id), admins can see values
 */
export const listSecrets: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId } = req.query

    if (!orgId && !projectId)
      throw new Exception(400, `orgId or projectId query parameter required`)

    // Check permission based on scope
    await checkPermission(req, EPermAction.read, EPermResource.secret, {
      orgId: orgId as string | undefined,
      projectId: projectId as string | undefined,
    })

    const { data, error } = await db.services.secret.list()

    if (error) throw new Exception(500, error.message)

    // Filter by orgId or projectId if provided
    let secrets: Secret[] = data || []
    if (orgId) secrets = secrets.filter((s) => s.orgId === orgId)
    if (projectId) secrets = secrets.filter((s) => s.projectId === projectId)

    // Check if user can see secret values
    const userRole = await getUserRole(req, {
      orgId: orgId as string | undefined,
      projectId: projectId as string | undefined,
    })
    const includeValue = canAccessSecretValue(userRole)

    // Return sanitized for members, full for admins
    const responseData = includeValue
      ? secrets
      : secrets.map((secret) => secret.sanitize())

    res.status(200).json({ data: responseData })
  },
}
