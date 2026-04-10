import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/providers - Create a new provider
 * Requires orgId in params or body
 * Requires admin+ role in that org
 */
export const createProvider: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId: paramOrgId } = req.params
    const providerData = req.body
    const orgId = paramOrgId || providerData.orgId

    if (!orgId) throw new Exception(400, `orgId is required`)

    db.services.provider.validateType(providerData.type)
    db.services.provider.validateLLM(providerData.type, providerData.brand)

    await checkPermission(req, EPermAction.create, EPermResource.provider, {
      orgId,
    })

    const { data, error } = await db.services.provider.create({
      ...providerData,
      orgId,
    })

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
