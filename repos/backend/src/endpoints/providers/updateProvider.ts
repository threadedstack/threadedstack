import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

/**
 * PUT /providers/:id - Update an existing provider
 * Requires admin+ role in the provider's org
 */
export const updateProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const providerData = req.body

    const existing = await requireResourceWithPermission(
      req,
      db.services.provider,
      id,
      EPermAction.update,
      EPermResource.provider,
      `Provider`,
      (provider) => ({ orgId: provider.orgId })
    )

    // Prevent accidental clearing of API key link
    // Allow secretId to be changed to a different secret, but not nulled out
    if (providerData.secretId === null) delete providerData.secretId

    // Merge with existing record so partial updates still validate correctly
    const effectiveType = providerData.type ?? existing.type
    const effectiveBrand = providerData.brand ?? existing.brand

    if (providerData.type) db.services.provider.validateType(providerData.type)
    db.services.provider.validateLLM(effectiveType, effectiveBrand)

    const { data, error } = await db.services.provider.update({ ...providerData, id })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
