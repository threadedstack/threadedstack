import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'
import type { TPermissionContext, EPermAction, EPermResource } from '@tdsk/domain'

import { EPermScope, fromAuthHeaders } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * Resolve a scope id with URL > query > header precedence.
 *
 * The URL is the canonical scope target. The auth header (set by the proxy
 * from the API key's bound scope) is only a fallback for URLs that don't
 * carry the id themselves. We do NOT reject on header/URL mismatch — a user
 * may legitimately belong to multiple orgs and use an org-scoped key against
 * a sibling org where they are also a member. The `authorize` permission
 * check (via `getUserRole`) is what enforces membership in the target scope.
 */
const resolveScopeId = (
  urlValue: string | undefined,
  queryValue: unknown,
  authValue: string | undefined
): string | undefined => {
  const safeQuery = typeof queryValue === `string` ? queryValue : undefined
  return urlValue || safeQuery || authValue
}

/**
 * Middleware to check permission for an action on a resource.
 * Scope is taken from the URL first, query second, headers last.
 *
 * This is the key v2 fix: pre-v2 the header was preferred over the URL,
 * which allowed a key bound to orgA to read orgB resources by URL — the
 * permission check ran against orgA where the user was admin. With URL-first
 * precedence, the permission check runs against the URL's scope, so
 * `getUserRole` rejects non-members of the target org/project.
 */
export const authorize = (action: EPermAction, resource: EPermResource) => {
  return async (req: TRequest, _res: TResponse, next: NextFunction) => {
    try {
      const auth = fromAuthHeaders(req)
      const projectId = resolveScopeId(
        req.params.projectId as string | undefined,
        req.query?.projectId,
        auth.projectId
      )
      const orgId = resolveScopeId(
        req.params.orgId as string | undefined,
        req.query?.orgId,
        auth.orgId
      )

      const context: TPermissionContext = {
        orgId,
        projectId,
        resourceId: req.params.id,
        scopeType: projectId ? EPermScope.project : EPermScope.org,
      }

      await checkPermission(req, action, resource, context)
      next()
    } catch (error) {
      next(error)
    }
  }
}
