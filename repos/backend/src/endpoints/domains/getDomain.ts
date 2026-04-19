import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /domains/:domain - Get a specific domain by name
 * User must have permission to view the domain's org or project
 */
export const getDomain: TEndpointConfig = {
  path: `/:domain`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.domain)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { domain } = req.params
    const { db } = req.app.locals

    if (!domain) throw new Exception(400, `Domain parameter is required`)

    const { data: record, error } = await db.services.domain.by({ domain })
    if (error) throw new Exception(404, error?.message || `Domain "${domain}" not found!`)

    res.status(200).json({ data: record })
  },
}
