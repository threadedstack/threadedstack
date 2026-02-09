import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { validateExclusiveArc } from '@TBE/utils/validation/exclusiveArc'

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
    validateExclusiveArc(
      [
        { name: `orgId`, value: orgId },
        { name: `projectId`, value: projectId },
      ],
      `Provider`
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
