import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

export const deleteSandbox: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.sandbox)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, sandbox: sbService } = req.app.locals
    const { id } = req.params

    await requireResource(db.services.sandbox, id, `Sandbox`)

    if (sbService) {
      const activeSessions = sbService.getShellSessionsForSandbox(id)
      if (activeSessions.length > 0) {
        throw new Exception(
          409,
          `Cannot delete sandbox with ${activeSessions.length} active session(s)`
        )
      }
    }

    const { data, error } = await db.services.sandbox.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
