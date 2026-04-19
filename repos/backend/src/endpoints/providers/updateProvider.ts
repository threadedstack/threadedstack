import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { requireResource } from '@TBE/utils/auth/requireResource'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /providers/:id - Update an existing provider
 * Requires admin+ role in the provider's org
 */
export const updateProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.provider)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { name, baseUrl, defaultModel, config, type, brand, secretId } = req.body

    const existing = await requireResource(db.services.provider, id, `Provider`)

    // Merge with existing record so partial updates still validate correctly
    const effectiveType = type ?? existing.type
    const effectiveBrand = brand ?? existing.brand

    if (type) db.services.provider.validateType(type)
    db.services.provider.validateLLM(effectiveType, effectiveBrand)

    const { data, error } = await db.services.provider.update({
      id,
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(brand !== undefined && { brand }),
      ...(config !== undefined && { config }),
      ...(baseUrl !== undefined && { baseUrl }),
      ...(defaultModel !== undefined && { defaultModel }),
      ...(secretId !== undefined && secretId !== null && { secretId }),
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
