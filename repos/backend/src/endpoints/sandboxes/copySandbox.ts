import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import {
  Sandbox,
  Exception,
  ERoleType,
  hasMinRole,
  EPermAction,
  EPermResource,
} from '@tdsk/domain'

/**
 * POST /sandboxes/:id/copy - Deep-copy a sandbox config
 * Creates a new sandbox with the same config, builtIn: false
 */
export const copySandbox: TEndpointConfig = {
  path: `/:id/copy`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const orgId = req.params.orgId || req.body.orgId

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!id) throw new Exception(400, `Sandbox ID is required`)

    const original = await resolveSandbox(
      db.services.sandbox,
      id,
      req.params.projectId,
      req.params.orgId
    )
    if (original.orgId !== orgId)
      throw new Exception(
        403,
        `Sandbox does not belong to this organization`,
        `FORBIDDEN`
      )

    const name = req.body.name || `${original.name} (copy)`
    // A copy is customer-owned output; never inherit the platform-only nodePool
    // scheduling control from the source sandbox.
    const config = { ...original.config }
    delete config.nodePool
    const copy = new Sandbox({
      name,
      builtIn: false,
      orgId: original.orgId,
      userId: req.user?.id,
      config,
    })

    // Admins copy all project associations; non-admins only get projects they belong to
    let projectsToLink = original.projects || []
    if (projectsToLink.length) {
      const userRole = await getUserRole(req, { orgId })
      if (!hasMinRole(userRole, ERoleType.admin)) {
        const userId = req.user?.id
        if (userId) {
          const { data: userProjectIds, error: projErr } =
            await db.services.role.getUserProjects(userId)
          if (projErr) throw new Exception(500, `Failed to retrieve user projects`)
          if (userProjectIds?.length) {
            const userProjSet = new Set(userProjectIds)
            projectsToLink = projectsToLink.filter((p) => userProjSet.has(p.id))
          } else {
            projectsToLink = []
          }
        }
      }
    }

    const { data, error } = await db.services.sandbox.create({
      ...copy,
      ...(projectsToLink.length ? { projects: projectsToLink } : {}),
    })
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
