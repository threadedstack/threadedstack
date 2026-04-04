import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'

/**
 * GET /subscriptions/invoices - Get invoices for the current user
 * Queries the local invoices table by userId.
 */
export const getInvoices: TEndpointConfig = {
  path: `/invoices`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data, error } = await db.services.invoice.findByUserId(userId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [] })
  },
}
