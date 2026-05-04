import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /domains/:domain - Delete a domain
 * User must have permission to delete domains from the org or project
 */
export const deleteDomain: TEndpointConfig = {
  path: `/:domain`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.domain)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { domain } = req.params
    const { db } = req.app.locals

    if (!domain) throw new Exception(400, `Domain parameter is required`)

    const { data: record, error } = await db.services.domain.by({ domain })
    if (error) throw new Exception(500, error.message)
    if (!record) throw new Exception(404, `Domain "${domain}" not found!`)

    // Delete the domain
    const { error: deleteError } = await db.services.domain.delete(domain)
    if (deleteError) throw new Exception(500, deleteError.message)

    res.status(200).json({
      data: {
        domain,
        success: true,
      },
    })
  },
}
