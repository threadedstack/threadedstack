import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'
import type { EPermAction, EPermResource } from '@tdsk/domain'
import type { TPermissionContext } from '@TBE/utils/auth/checkPermission'

import { ERoleType } from '@tdsk/domain'
import {
  checkPermission,
  requireMinRole,
  requireOrgMember,
  requireProjectMember,
} from '@TBE/utils/auth/checkPermission'

/**
 * Middleware to check permission for an action on a resource
 * Context is extracted from request params (orgId, projectId)
 */
export const authorize = (action: EPermAction, resource: EPermResource) => {
  return async (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const context: TPermissionContext = {
        orgId: req.params.orgId || req.body?.orgId || (req.query?.orgId as string),
        projectId:
          req.params.projectId || req.body?.projectId || (req.query?.projectId as string),
        resourceId: req.params.id,
      }

      await checkPermission(req, action, resource, context)
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware to require org membership
 * Extracts orgId from params, body, or query
 */
export const requireOrg = () => {
  return async (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const orgId =
        req.params.orgId ||
        req.params.id ||
        req.body?.orgId ||
        (req.query?.orgId as string)

      if (!orgId) {
        throw new Error(`Organization ID required`)
      }

      await requireOrgMember(req, orgId)
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware to require project membership
 * Extracts projectId from params, body, or query
 */
export const requireProject = () => {
  return async (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const projectId =
        req.params.projectId ||
        req.params.id ||
        req.body?.projectId ||
        (req.query?.projectId as string)

      if (!projectId) {
        throw new Error(`Project ID required`)
      }

      await requireProjectMember(req, projectId)
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware to require minimum role level
 */
export const requireRole = (role: ERoleType) => {
  return async (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const context: TPermissionContext = {
        orgId: req.params.orgId || req.body?.orgId || (req.query?.orgId as string),
        projectId:
          req.params.projectId || req.body?.projectId || (req.query?.projectId as string),
      }

      await requireMinRole(req, role, context)
      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Middleware to allow only super admins
 */
export const superAdminOnly = () => requireRole(ERoleType.super)

/**
 * Middleware to allow owners and above
 */
export const ownerOnly = () => requireRole(ERoleType.owner)

/**
 * Middleware to allow admins and above
 */
export const adminOnly = () => requireRole(ERoleType.admin)

/**
 * Middleware to allow members and above
 */
export const memberOnly = () => requireRole(ERoleType.member)
