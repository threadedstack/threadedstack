import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:sandboxId/config - Get sandbox project-level config overrides
 * Returns the sandboxProjects row for the given sandbox+project pair
 */
export const getSBPConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { sandboxId, projectId } = req.params

    if (!sandboxId) throw new Exception(400, `sandboxId parameter required`)
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Get the sandbox to check permissions
    const { data: sandbox, error: getError } = await db.services.sandbox.get(sandboxId)
    if (getError) throw new Exception(500, getError.message)
    if (!sandbox) throw new Exception(404, `Sandbox not found`)

    const { data: config, error } = await db.services.sandbox.getProjectConfig(
      sandboxId,
      projectId
    )

    if (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const status = msg.includes('not linked') ? 404 : 500
      throw new Exception(status, msg)
    }

    res.status(200).json({ data: config })
  },
}
