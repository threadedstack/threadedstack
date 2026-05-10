import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/providers - Create a new provider
 * Requires orgId in params or body
 * Requires admin+ role in that org
 */
export const createProvider: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.provider)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId: paramOrgId } = req.params
    const provider = req.body
    const orgId = paramOrgId || provider.orgId

    if (!orgId) throw new Exception(400, `orgId is required`)

    db.services.provider.validType(provider.type, provider.brand)

    const { data, error } = await db.services.provider.create({
      ...provider,
      orgId,
    })

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
