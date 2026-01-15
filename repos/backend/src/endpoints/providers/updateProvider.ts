import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Provider, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'

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

    // Get existing provider to find its scope
    const { data: existingProvider, error: getError } = await db.services.provider.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingProvider) {
      res.status(404).json({ error: 'Provider not found' })
      return
    }

    // Check permission based on provider's scope
    const context = {
      orgId: existingProvider.orgId || undefined,
      projectId: existingProvider.projectId || undefined,
    }

    await checkPermission(req, EPermAction.update, EPermResource.provider, context)

    // Update the provider
    const { data, error } = await db.services.provider.update({ ...providerData, id })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}
