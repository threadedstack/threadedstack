import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Provider, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { HttpMethods } from '@TBE/constants/values'

/**
 * POST /providers - Create a new provider
 * Requires orgId or projectId in body
 * Requires admin+ role in that scope
 */
export const createProvider: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const providerData = req.body
    const { orgId, projectId } = providerData

    // Validate Exclusive Arc: must have exactly one of orgId, projectId
    if (!orgId && !projectId) {
      res
        .status(400)
        .json({
          error:
            'Provider must belong to an org or project (orgId or projectId required)',
        })
      return
    }

    if (orgId && projectId) {
      res
        .status(400)
        .json({
          error: 'Provider cannot belong to both org and project (provide only one)',
        })
      return
    }

    // Check permission to create providers in this scope
    await checkPermission(req, EPermAction.create, EPermResource.provider, {
      orgId,
      projectId,
    })

    // Create the provider
    const { data, error } = await db.services.provider.create(providerData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}
