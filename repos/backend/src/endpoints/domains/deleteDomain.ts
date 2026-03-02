import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
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

    if (!domain) throw new Exception(400, `Domain parameter is required`)

    const { data: record, error } = await db.services.domain.by({ domain })

    if (error) throw new Exception(404, error?.message || `Domain "${domain}" not found!`)

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
    const { error: deleteError } = await db.services.domain.delete(domain)
    if (deleteError) throw new Exception(500, deleteError.message)

    const deleted = domain

    res.status(200).json({
      data: {
        success: true,
        domain: deleted,
      },
    })
  },
}
