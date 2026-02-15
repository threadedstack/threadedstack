import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'
import { validateProviderType } from '@TBE/utils/providers/validateProviderType'

/**
 * PUT /providers/:id - Update an existing provider
 * Get provider first to find scope
 * Requires admin+ role in that scope
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
      (provider) => ({
        orgId: provider.orgId || undefined,
        projectId: provider.projectId || undefined,
      })
    )

    // Validate provider type if being changed
    providerData.type && validateProviderType(providerData.type)

    // Update the provider
    const { data, error } = await db.services.provider.update({ ...providerData, id })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
