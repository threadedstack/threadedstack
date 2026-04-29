import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:sandboxId/config - Reset sandbox project-level config overrides
 * Resets all override columns to null (enabled back to true)
 */
export const deleteSBPConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.update, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Validate the sandbox exists
    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError || !sandbox) throw new Exception(404, `Sandbox not found`)

    const { error } = await db.services.sandbox.upsertProjectConfig(
      sandboxId,
      projectId,
      {
        enabled: true,
        config: null,
      }
    )

    if (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const status = msg.includes('not linked') ? 404 : 500
      throw new Exception(status, msg)
    }

    res.status(200).json({ data: { id: sandboxId, configReset: true } })
  },
}
