import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource, isValidSandboxAlias } from '@tdsk/domain'

/**
 * PUT /:sandboxId/config - Upsert sandbox project-level config overrides
 * Updates override columns on the sandboxProjects row
 * Returns the full effective sandbox config
 */
export const upsertSBPConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Validate the sandbox exists and get org info
    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError) throw new Exception(500, getError.message)
    if (!sandbox) throw new Exception(404, `Sandbox not found`)

    const { alias, enabled, config } = req.body

    if (alias !== undefined && !isValidSandboxAlias(alias))
      throw new Exception(
        400,
        `Invalid alias: must be lowercase alphanumeric with hyphens, max 63 chars`
      )

    const overrides = Object.fromEntries(
      Object.entries({ alias, enabled, config }).filter(([, v]) => v !== undefined)
    )

    const { error: upsertError } = await db.services.sandbox.upsertProjectConfig(
      sandboxId,
      projectId,
      overrides
    )

    if (upsertError) {
      const msg = upsertError instanceof Error ? upsertError.message : String(upsertError)
      const status = msg.includes('not linked') ? 404 : 500
      throw new Exception(status, msg)
    }

    // Re-fetch the sandbox to get updated projectConfigs and return effective config
    const { data: updatedSandbox, error: refetchError } =
      await db.services.sandbox.get(sandboxId)
    if (refetchError) throw new Exception(500, refetchError.message)
    if (!updatedSandbox) throw new Exception(500, `Failed to fetch updated sandbox`)

    const effectiveSandbox = updatedSandbox.getEffectiveConfig(projectId)

    res.status(200).json({ data: effectiveSandbox })
  },
}
