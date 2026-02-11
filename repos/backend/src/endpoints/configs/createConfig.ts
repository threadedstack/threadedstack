import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { validateExclusiveArc } from '@TBE/utils/validation/exclusiveArc'
import { Config, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/configs - Create a new config
 * Requires admin+ role in the org/project
 */
export const createConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { data, userId } = req.body
    const orgId = req.params.orgId || req.body.orgId
    const projectId = req.params.projectId || req.body.projectId

    if (!data) throw new Exception(400, `Config data is required`)

    const arcFields = [
      { name: `orgId`, value: orgId },
      { name: `userId`, value: userId },
      { name: `projectId`, value: projectId },
    ]
    validateExclusiveArc(arcFields, `Config`)

    // Check permission - requires admin+
    await checkPermission(req, EPermAction.create, EPermResource.config, {
      orgId,
      projectId,
    })

    try {
      const config = new Config({
        data,
        ...(orgId && { orgId }),
        ...(projectId && { projectId }),
        ...(userId && { userId }),
      })

      const { data: createdConfig, error } = await db.services.config.create(config)
      if (error) throw new Exception(500, error.message)

      res.status(201).json({ data: createdConfig })
    } catch (err) {
      if (err instanceof Exception) throw err
      const message = err instanceof Error ? err.message : `Failed to create config`
      throw new Exception(500, message)
    }
  },
}
