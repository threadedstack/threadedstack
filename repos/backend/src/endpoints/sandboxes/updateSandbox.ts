import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { resolveSandbox } from '@TBE/utils/sandbox/resolveSandbox'
import { EProvider, Exception, EPermAction, EPermResource } from '@tdsk/domain'

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

    const existing = await resolveSandbox(db.services.sandbox, id, req.params.projectId)

    const { name, config, projectIds, providerInputs } = req.body

    if (config?.idleTimeoutMinutes != null && config.idleTimeoutMinutes < 1)
      throw new Exception(400, `idleTimeoutMinutes must be at least 1`)
    if (config?.gitBranch && !config?.gitRepo)
      throw new Exception(400, `gitBranch requires gitRepo to be set`)

    const pins = await db.services.provider.validate({
      type: EProvider.ai,
      orgId: existing.orgId,
      inputs: providerInputs,
    })

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
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
