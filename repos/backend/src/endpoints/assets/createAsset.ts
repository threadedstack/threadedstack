import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TArcField } from '@TBE/utils/validation/exclusiveArc'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { validateExclusiveArc } from '@TBE/utils/validation/exclusiveArc'
import { Asset, Exception, EPermAction, EPermResource } from '@tdsk/domain'

const getPermissionIds = async (req: TRequest, owner: TArcField) => {
  const { db } = req.app.locals
  const { orgId, projectId } = req.body

  switch (owner.name) {
    case `projectId`: {
      const { data: project } = await db.services.project.get(owner.value)
      if (!project) throw new Exception(404, `Project not found`)
      return {
        orgId: project.orgId,
        projectId: project.id,
      }
    }
    case `threadId`: {
      const { data: thread } = await db.services.thread.get(owner.value)
      if (!thread) throw new Exception(404, `Thread not found`)

      return {
        projectId,
        orgId: thread.orgId,
      }
    }
    case `messageId`: {
      const { data: message } = await db.services.message.get(owner.value)
      if (!message) throw new Exception(404, `Message not found`)

      return {
        projectId,
        orgId: message.orgId,
      }
    }
    case `orgId`: {
      return {
        projectId,
        orgId: owner.value,
      }
    }
    case `userId`: {
      // User-scoped assets — verify the authenticated user owns the asset
      if (owner.value !== req.user?.id)
        throw new Exception(403, `Cannot create assets for another user`)

      return {
        orgId,
        projectId,
      }
    }
    default: {
      throw new Exception(400, `Unsupported asset owner type: ${owner.name}`)
    }
  }
}

/**
 * POST /assets - Create a new asset
 * Requires exactly one owner scope (exclusive arc)
 */
export const createAsset: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
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

    // Validate exclusive arc: exactly one owner
    const arcFields = [
      { name: `orgId`, value: orgId },
      { name: `userId`, value: userId },
      { name: `threadId`, value: threadId },
      { name: `messageId`, value: messageId },
      { name: `projectId`, value: projectId },
    ]
    const owner = validateExclusiveArc(arcFields, `Asset`)

    const permIds = await getPermissionIds(req, owner)

    await checkPermission(req, EPermAction.create, EPermResource.asset, permIds)

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
