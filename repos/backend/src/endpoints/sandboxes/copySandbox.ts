import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Sandbox, Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /sandboxes/:id/copy - Deep-copy a sandbox config
 * Creates a new sandbox with the same config, builtIn: false
 */
export const copySandbox: TEndpointConfig = {
  path: `/:id/copy`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const orgId = req.params.orgId || req.body.orgId

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!id) throw new Exception(400, `Sandbox ID is required`)

    const { data: original, error: getError } = await db.services.sandbox.get(id)
    if (getError || !original) throw new Exception(404, `Sandbox not found`)
    if (original.orgId !== orgId) throw new Exception(404, `Sandbox not found`)

    await checkPermission(req, EPermAction.create, EPermResource.sandbox, {
      orgId: original.orgId,
    })

    const name = req.body.name || `${original.name} (copy)`
    const copy = new Sandbox({
      name,
      builtIn: false,
      orgId: original.orgId,
      userId: req.user?.id,
      config: { ...original.config },
      projectId: req.body.projectId ?? original.projectId,
    })

    const { data, error } = await db.services.sandbox.create(copy)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
