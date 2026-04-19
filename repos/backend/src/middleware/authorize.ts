import type { NextFunction } from 'express'
import type { EPermAction, EPermResource } from '@tdsk/domain'
import type { TRequest, TResponse, TPermissionContext } from '@TBE/types'

import { fromAuthHeaders } from '@tdsk/domain'
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
      const context: TPermissionContext = {
        resourceId: req.params.id,
        projectId:
          req.params.projectId || (req.query?.projectId as string) || req.body?.projectId,
        orgId:
          auth.orgId ||
          req.params.orgId ||
          (req.query?.orgId as string) ||
          req.body?.orgId,
      }

      await checkPermission(req, action, resource, context)
      next()
    } catch (error) {
      next(error)
    }
  }
}
