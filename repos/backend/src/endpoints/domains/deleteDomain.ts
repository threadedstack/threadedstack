import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /domains/:domain - Delete a domain
 * User must have permission to delete domains from the org or project
 */
export const deleteDomain: TEndpointConfig = {
  path: `/:domain`,
  method: EPMethod.Delete,
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

    // Check permission
    if (record.orgId) {
      await checkPermission(req, EPermAction.delete, EPermResource.domain, {
        orgId: record.orgId,
      })
    } else if (record.projectId) {
      // Get project to find orgId
      const { data: project } = await db.services.project.get(record.projectId)
      if (project) {
        await checkPermission(req, EPermAction.delete, EPermResource.domain, {
          orgId: project.orgId,
        })
      }
    }

    // Delete the domain
    const deleted = await db.services.domain.deleteDomain(domain)

    res.status(200).json({
      data: {
        success: true,
        domain: deleted,
      },
    })
  },
}
