import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { validateExclusiveArc } from '@TBE/utils/validation/exclusiveArc'
import { Asset, Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /assets - Create a new asset
 * Requires exactly one owner scope (exclusive arc)
 */
export const createAsset: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.asset)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      url,
      meta,
      type,
      name,
      orgId,
      userId,
      content,
      threadId,
      projectId,
      messageId,
      providerId,
    } = req.body

    if (!name) throw new Exception(400, `Asset name is required`)
    if (!type) throw new Exception(400, `Asset type is required`)

    if (userId && userId !== req.user?.id)
      throw new Exception(403, `Cannot create assets for another user`)

    // Validate exclusive arc: exactly one owner
    const arcFields = [
      { name: `orgId`, value: orgId },
      { name: `userId`, value: userId },
      { name: `threadId`, value: threadId },
      { name: `messageId`, value: messageId },
      { name: `projectId`, value: projectId },
    ]
    const owner = validateExclusiveArc(arcFields, `Asset`)

    const asset = new Asset({
      name,
      type,
      ...(url && { url }),
      ...(meta && { meta }),
      ...(orgId && { orgId }),
      ...(userId && { userId }),
      ...(content && { content }),
      ...(threadId && { threadId }),
      ...(projectId && { projectId }),
      ...(messageId && { messageId }),
      ...(providerId && { providerId }),
    })

    const { data, error } = await db.services.asset.create(asset)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
