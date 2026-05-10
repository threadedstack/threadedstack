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
    const {
      name,
      config,
      options,
      headers,
      baseUrl,
      secretId,
      bodyParams,
      defaultModel,
    } = req.body

    const existing = await requireResource(db.services.provider, id, `Provider`)

    // Merge with existing record so partial updates still validate correctly
    const type = req.body.type ?? existing.type
    const brand = req.body.brand ?? existing.brand

    db.services.provider.validType(type, brand)

    const { data, error } = await db.services.provider.update({
      id,
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(brand !== undefined && { brand }),
      ...(config !== undefined && { config }),
      ...(options !== undefined && { options }),
      ...(headers !== undefined && { headers }),
      ...(baseUrl !== undefined && { baseUrl }),
      ...(bodyParams !== undefined && { bodyParams }),
      ...(defaultModel !== undefined && { defaultModel }),
      ...(secretId !== undefined && secretId !== null && { secretId }),
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
