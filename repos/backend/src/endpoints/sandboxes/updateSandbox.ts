import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { EProvider, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { validateGitProviderInputs } from '@TBE/utils/sandbox/validateGitProviderInputs'

/**
 * PUT /_/sandboxes/:id - Update a sandbox
 * Can optionally update project associations by passing projectIds array
 */
export const updateSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const existing = await resolveSandbox(
      db.services.sandbox,
      id,
      req.params.projectId,
      req.params.orgId
    )

    const { name, config, projectIds, skillInputs, providerInputs, gitProviderInputs } =
      req.body

    if (config?.idleTimeoutMinutes != null && config.idleTimeoutMinutes < 1)
      throw new Exception(400, `idleTimeoutMinutes must be at least 1`)

    if (config?.maxInstances != null)
      config.maxInstances = Math.max(1, Math.floor(config.maxInstances))

    if (skillInputs !== undefined) {
      if (!Array.isArray(skillInputs))
        throw new Exception(400, `skillInputs must be an array`)
      for (const input of skillInputs) {
        if (!input?.id || typeof input.id !== `string`)
          throw new Exception(400, `Each skillInput must have a string "id" field`)
      }
    }

    const pins = await db.services.provider.validate({
      orgId: existing.orgId,
      inputs: providerInputs,
      type: [EProvider.ai, EProvider.docker],
    })

    const validatedGitInputs = await validateGitProviderInputs(
      db,
      existing.orgId,
      gitProviderInputs
    )

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({
          where: { id: projectIds, orgId: existing.orgId },
        })
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

    const { data, error } = await db.services.sandbox.update({
      id: existing.id,
      ...(name !== undefined && { name }),
      ...(config !== undefined && { config }),
      ...(pins !== undefined && { providerInputs: pins }),
      ...(projectIds !== undefined ? { projects: projects || [] } : {}),
      ...(validatedGitInputs !== undefined && { gitProviderInputs: validatedGitInputs }),
    })
    if (error) throw new Exception(500, error.message)

    if (skillInputs !== undefined) {
      const projectId = req.params.projectId
      const { error: skillErr } = await db.services.sandbox.setSkills(
        existing.id,
        skillInputs,
        projectId
      )
      if (skillErr)
        throw new Exception(
          500,
          `Failed to update sandbox skills: ${(skillErr as Error).message}`
        )
      const { data: refreshed } = await db.services.sandbox.get(existing.id)
      res.status(200).json({ data: refreshed ?? data })
      return
    }

    res.status(200).json({ data })
  },
}
