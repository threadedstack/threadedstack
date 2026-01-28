import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /domains/:domain - Get a specific domain by name
 * User must have permission to view the domain's org or project
 */
export const getDomain: TEndpointConfig = {
  path: `/:domain`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { domain } = req.params
    const { db } = req.app.locals

    if (!domain) {
      res.status(400).json({ error: 'Domain parameter is required' })
      return
    }

    const { data: record, error } = await db.services.domain.by({ domain })

    if (error) {
      res.status(404).json({ error: error?.message || `Domain "${domain}" not found!` })
      return
    }

    // Check permission based on whether domain belongs to org or project
    if (record.orgId) {
      await checkPermission(req, EPermAction.read, EPermResource.domain, {
        orgId: record.orgId,
      })
    } else if (record.projectId) {
      // Get project to find orgId
      const { data: project } = await db.services.project.get(record.projectId)
      if (project) {
        await checkPermission(req, EPermAction.read, EPermResource.domain, {
          orgId: project.orgId,
        })
      }
    }

    res.status(200).json({ data: record })
  },
}
