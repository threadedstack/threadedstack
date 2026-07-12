import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { validateGitProviderInputs } from '@TBE/utils/sandbox/validateGitProviderInputs'
import { Sandbox, Exception, EProvider, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/sandboxes - Create a new sandbox
 * Requires orgId in params or body
 * Optionally accepts projectIds array to associate with projects
 * Requires admin+ role in the organization
 */
export const createSandbox: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      name,
      config,
      skillInputs,
      providerInputs,
      gitProviderInputs,
      projectId: bodyProjectId,
      projectIds: bodyProjectIds,
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

    if (config?.maxInstances != null)
      config.maxInstances = Math.max(1, Math.floor(config.maxInstances))

    // nodePool is a platform-only scheduling control (which physical node pool a
    // sandbox lands on) — never customer-settable, or a tenant could schedule
    // workloads onto an internal/other-tenant pool. The platform sets it
    // out-of-band (seed/reconcile/DB), so strip it from request input.
    if (config?.nodePool !== undefined) delete config.nodePool

    if (skillInputs !== undefined) {
      if (!Array.isArray(skillInputs))
        throw new Exception(400, `skillInputs must be an array`)
      for (const input of skillInputs) {
        if (!input?.id || typeof input.id !== `string`)
          throw new Exception(400, `Each skillInput must have a string "id" field`)
      }
    }

    const pins = await db.services.provider.validate({
      orgId,
      inputs: providerInputs,
      type: [EProvider.ai, EProvider.docker],
    })

    const validatedGitInputs = await validateGitProviderInputs(
      db,
      orgId,
      gitProviderInputs
    )

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
      ...(validatedGitInputs?.length ? { gitProviderInputs: validatedGitInputs } : {}),
      ...(projects?.length ? { projects } : {}),
    })
    if (error) throw new Exception(500, error.message)

    if (data && skillInputs?.length) {
      const { error: skillErr } = await db.services.sandbox.setSkills(
        data.id,
        skillInputs
      )
      if (skillErr)
        throw new Exception(
          500,
          `Sandbox created but skill association failed: ${(skillErr as Error).message}`
        )
      const { data: refreshed } = await db.services.sandbox.get(data.id)
      res.status(201).json({ data: refreshed ?? data })
      return
    }

    res.status(201).json({ data })
  },
}
