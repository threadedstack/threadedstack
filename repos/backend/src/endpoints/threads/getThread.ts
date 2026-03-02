import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /:orgId/agents/:agentId/threads/:id - Get a thread by ID
 * Validates the thread belongs to the agent and the user
 *
 * Supports `?include=` query param (comma-separated):
 *   - `branches` — include child threads as `branches` array
 *   - `parent`   — include parent thread as `parentThread` object
 */
export const getThread: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id, agentId } = req.params
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data: thread, error } = await db.services.thread.get(id)

    if (error || !thread) throw new Exception(404, `Thread not found`)

    // Validate thread belongs to this agent
    if (thread.agentId !== agentId) throw new Exception(404, `Thread not found`)

    await checkPermission(req, EPermAction.read, EPermResource.thread, {
      orgId: thread.orgId,
    })

    if (thread.userId !== userId) throw new Exception(403, `Access denied`)

    const include = (req.query.include as string)?.split(`,`).map((s) => s.trim()) || []
    const result: Record<string, any> = { ...thread }

    if (include.includes(`branches`)) {
      const { data: branches, error: branchErr } =
        await db.services.thread.listBranches(id)
      if (branchErr) logger.warn(`Failed to load branches for thread ${id}: ${branchErr}`)
      result.branches = branches || []
    }

    if (include.includes(`parent`) && thread.parentThreadId) {
      const { data: parent } = await db.services.thread.get(thread.parentThreadId)
      // Only include parent if caller has access (same org and same user)
      if (parent && parent.orgId === thread.orgId && parent.userId === userId) {
        result.parentThread = parent
      } else {
        result.parentThread = null
      }
    }

    res.status(200).json({ data: result })
  },
}
