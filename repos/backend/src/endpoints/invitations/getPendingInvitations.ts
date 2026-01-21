import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'

/**
 * GET /_/invitations/me - Get pending invitations for the current user
 * Authenticated endpoint - returns invitations sent to the user's email
 *
 * Used to show pending invitations when a user logs in
 */
export const getPendingInvitations: TEndpointConfig = {
  path: `/me`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const user = req.user
    const { db } = req.app.locals

    if (!user || !user.email) throw new Exception(401, `You must be logged in`)

    const { data, error } = await db.services.invitation.getPendingByEmail(user.email)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
