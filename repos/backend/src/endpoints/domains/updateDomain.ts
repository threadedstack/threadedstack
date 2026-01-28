import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PATCH /domains/:domain - Update a domain
 * Currently limited to verification status
 * User must have permission to update the domain's org or project
 */
export const updateDomain: TEndpointConfig = {
  path: `/:domain`,
  method: EPMethod.Patch,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { domain } = req.params
    const { verified } = req.body
    const { db } = req.app.locals

    if (!domain) {
      res.status(400).json({ error: 'Domain parameter is required' })
      return
    }

    // Get the domain first to check permissions
    const { data: record, error } = await db.services.domain.by({ domain })

    if (error) {
      res.status(404).json({ error: error?.message || `Domain "${domain}" not found!` })
      return
    }

    // Check permission
    if (record.orgId) {
      await checkPermission(req, EPermAction.update, EPermResource.domain, {
        orgId: record.orgId,
      })
    } else if (record.projectId) {
      // Get project to find orgId
      const { data: project } = await db.services.project.get(record.projectId)
      if (project) {
        await checkPermission(req, EPermAction.update, EPermResource.domain, {
          orgId: project.orgId,
        })
      }
    }

    // Update verification status if requested
    if (verified === true) {
      const updated = await db.services.domain.verified(domain)
      res.status(200).json({ data: updated })
    } else {
      res.status(400).json({ error: `Only verification status can be updated` })
    }
  },
}
