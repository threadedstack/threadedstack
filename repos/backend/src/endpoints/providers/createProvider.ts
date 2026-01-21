import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /_/providers - Create a new provider
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
    if (!orgId && !projectId)
      throw new Exception(
        400,
        `Provider must belong to an org or project (orgId or projectId required)`
      )

    if (orgId && projectId)
      throw new Exception(
        400,
        `Provider cannot belong to both org and project (provide only one)`
      )

    // Check permission to create providers in this scope
    await checkPermission(req, EPermAction.create, EPermResource.provider, {
      orgId,
      projectId,
    })

    // Create the provider
    const { data, error } = await db.services.provider.create(providerData)

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
