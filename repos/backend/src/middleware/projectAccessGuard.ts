import type { NextFunction } from 'express'
import type { TAHandler } from '@tdsk/domain'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { fromAuthHeaders } from '@tdsk/domain'

/**
 * Middleware that enforces project-level access boundaries for project-scoped API keys.
 * Org-scoped keys and JWT auth pass through unrestricted.
 * Project-scoped keys can only access their specific project.
 */
export const projectAccessGuard = () => {
  const callback = (req: TRequest, res: TResponse, next: NextFunction) => {
    try {
      const auth = fromAuthHeaders(req)
      const keyProjectId = auth.projectId

      // Org-scoped key or JWT auth — no project restriction.
      // (We do NOT reject on key.orgId vs URL orgId mismatch: a user may
      // belong to multiple orgs and use an org-scoped key against a sibling
      // org. The permission check via `authorize` -> `getUserRole` is the
      // membership boundary.)
      if (!keyProjectId) return next()

      // Project-scoped key — check if the request targets the correct project
      const queryProjectId = req.query?.projectId
      const safeQueryProjectId =
        typeof queryProjectId === `string` ? queryProjectId : undefined

      const targetProjectId =
        req.params.projectId || req.body?.projectId || safeQueryProjectId

      if (!targetProjectId) {
        logger.warn({
          message: `Project-scoped key blocked from org-level resource`,
          path: req.path,
          method: req.method,
          keyProjectId,
        })
        return res
          .status(403)
          .json({ error: `Project-scoped API key cannot access org-level resources` })
      }

      if (targetProjectId !== keyProjectId) {
        logger.warn({
          message: `Project-scoped key blocked from different project`,
          path: req.path,
          method: req.method,
          keyProjectId,
          targetProjectId,
        })
        return res
          .status(403)
          .json({ error: `API key does not have access to this project` })
      }

      next()
    } catch (error) {
      logger.error({
        message: `projectAccessGuard error`,
        path: req.path,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
      })
      next(error)
    }
  }

  return callback as TAHandler
}
