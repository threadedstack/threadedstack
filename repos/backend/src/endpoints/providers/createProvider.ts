import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { validateProviderType } from '@TBE/utils/providers/validateProviderType'
import { validateLLMProvider } from '@TBE/utils/providers/validateLLMProvider'

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

    validateProviderType(providerData.type)
    validateLLMProvider(providerData.type, providerData.brand)

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
