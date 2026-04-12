import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EProvider, Sandbox, Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/sandboxes - Create a new sandbox
 * Requires orgId in params or body
 * Optionally accepts projectIds array to associate with projects
 * Requires admin+ role in the organization
 */
export const createSandbox: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      name,
      config,
      projectIds: bodyProjectIds,
      projectId: bodyProjectId,
      providerInputs,
    } = req.body
    const orgId = req.params.orgId || req.body.orgId

    // Build projectIds from multiple sources:
    // 1. req.body.projectIds (array) — explicit project list from org-context form
    // 2. req.body.projectId (string) — singular shorthand from API callers
    // 3. req.params.projectId — from project-scoped route (/projects/:projectId/sandboxes)
    const projectIdSet = new Set<string>([
      ...(Array.isArray(bodyProjectIds) ? bodyProjectIds : []),
      ...(bodyProjectId ? [bodyProjectId] : []),
      ...(req.params.projectId ? [req.params.projectId] : []),
    ])
    const projectIds = [...projectIdSet]

    if (!name) throw new Exception(400, `Sandbox name is required`)
    if (!config?.image) throw new Exception(400, `Sandbox config.image is required`)
    if (!orgId) throw new Exception(400, `orgId is required`)
    if (config?.idleTimeoutMinutes != null && config.idleTimeoutMinutes < 1)
      throw new Exception(400, `idleTimeoutMinutes must be at least 1`)
    if (config?.gitBranch && !config?.gitRepo)
      throw new Exception(400, `gitBranch requires gitRepo to be set`)

    await checkPermission(req, EPermAction.create, EPermResource.sandbox, { orgId })

    const pins = await db.services.provider.validate({
      orgId,
      type: EProvider.ai,
      inputs: providerInputs,
    })

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds, orgId } })
      : { data: [] }

    if (projErr)
      throw new Exception(
        500,
        projErr instanceof Error ? projErr.message : String(projErr)
      )

    if (projectIds?.length && projects && projects.length !== projectIds.length) {
      const foundIds = new Set(projects.map((p: any) => p.id))
      const missing = projectIds.filter((pid: string) => !foundIds.has(pid))
      throw new Exception(400, `Projects not found: ${missing.join(', ')}`)
    }

    const sb = new Sandbox({
      name,
      orgId,
      config,
      builtIn: false,
      userId: req.user?.id,
    })

    const { data, error } = await db.services.sandbox.create({
      ...sb,
      ...(pins?.length ? { providerInputs: pins } : {}),
      ...(projects?.length ? { projects } : {}),
    })
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
