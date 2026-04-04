import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Sandbox, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

export const createSandbox: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, config, projectId } = req.body
    const orgId = req.params.orgId || req.body.orgId

    if (!name) throw new Exception(400, `Sandbox name is required`)
    if (!config?.image) throw new Exception(400, `Sandbox config.image is required`)
    if (!orgId) throw new Exception(400, `orgId is required`)
    if (config?.idleTimeoutMinutes != null && config.idleTimeoutMinutes < 1)
      throw new Exception(400, `idleTimeoutMinutes must be at least 1`)
    if (config?.gitBranch && !config?.gitRepo)
      throw new Exception(400, `gitBranch requires gitRepo to be set`)

    await checkPermission(req, EPermAction.create, EPermResource.sandbox, { orgId })

    const sandboxData = new Sandbox({
      name,
      orgId,
      config,
      projectId,
      userId: req.user?.id,
    })

    const { data, error } = await db.services.sandbox.create(sandboxData)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
