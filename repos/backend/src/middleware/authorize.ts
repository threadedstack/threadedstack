import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'
import type { TPermissionContext, EPermAction, EPermResource } from '@tdsk/domain'

import { EPermScope, fromAuthHeaders } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * Middleware to check permission for an action on a resource.
 * Context is extracted from request params, query, body, and auth headers.
 * This is the primary permission enforcement mechanism -- use on route configs.
 */
export const authorize = (action: EPermAction, resource: EPermResource) => {
  return async (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const auth = fromAuthHeaders(req)
      const projectId = req.params.projectId as string | undefined
      const context: TPermissionContext = {
        projectId,
        resourceId: req.params.id,
        scopeType: projectId ? EPermScope.project : EPermScope.org,
        orgId: auth.orgId || req.params.orgId || (req.query?.orgId as string),
      }

      await checkPermission(req, action, resource, context)
      next()
    } catch (error) {
      next(error)
    }
  }
}
