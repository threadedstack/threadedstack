import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { validateLLMProvider } from '@TBE/utils/providers/validateLLMProvider'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'
import { validateProviderType } from '@TBE/utils/providers/validateProviderType'

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

    await requireResourceWithPermission(
      req,
      db.services.provider,
      id,
      EPermAction.update,
      EPermResource.provider,
      `Provider`,
      (provider) => ({ orgId: provider.orgId })
    )

    providerData.type && validateProviderType(providerData.type)
    validateLLMProvider(providerData.type, providerData.brand)

    const { data, error } = await db.services.provider.update({ ...providerData, id })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
