import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { parsePagination } from '@TBE/utils/pagination'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /assets - List assets filtered by scope
 * Requires at least one filter: orgId, projectId, threadId, or messageId
 */
export const listAssets: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId, threadId, messageId } = req.query

    if (!orgId && !projectId && !threadId && !messageId)
      throw new Exception(
        400,
        `At least one filter is required: orgId, projectId, threadId, or messageId`
      )

    // Resolve orgId for permission check from the provided scope
    let permOrgId = orgId as string | undefined

    if (threadId && !permOrgId) {
      const { data: thread } = await db.services.thread.get(threadId as string)
      if (!thread) throw new Exception(404, `Thread not found`)
      permOrgId = thread.orgId
    }

    if (messageId && !permOrgId) {
      const { data: message } = await db.services.message.get(messageId as string)
      if (!message) throw new Exception(404, `Message not found`)
      permOrgId = message.orgId
    }

    await checkPermission(req, EPermAction.read, EPermResource.asset, {
      orgId: permOrgId,
      projectId: projectId as string,
    })

    const { limit, offset } = parsePagination(req)

    const where: Record<string, string> = {}
    if (orgId) where.orgId = orgId as string
    if (projectId) where.projectId = projectId as string
    if (threadId) where.threadId = threadId as string
    if (messageId) where.messageId = messageId as string

    const { data, error } = await db.services.asset.list({ where, limit, offset })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}
