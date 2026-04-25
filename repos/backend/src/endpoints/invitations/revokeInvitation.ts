import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /_/invitations/:invitationId - Revoke an invitation
 * Requires admin+ role in the org
 *
 * Only pending invitations can be revoked
 */
export const revokeInvitation: TEndpointConfig = {
  path: `/:invitationId`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { invitationId } = req.params
    const user = req.user

    if (!user) throw new Exception(401, `You must be logged in to revoke an invitation`)

    // Get the invitation
    const { data: invitation, error: invitationError } =
      await db.services.invitation.get(invitationId)

    if (invitationError) throw new Exception(500, invitationError.message)

    if (!invitation) throw new Exception(404, `Invitation not found`)

    // Validate invitation can be revoked
    if (invitation.isRevoked())
      throw new Exception(400, `This invitation has already been revoked`)

    if (invitation.isAccepted())
      throw new Exception(
        400,
        `This invitation has already been accepted. Use the role management endpoints to remove the user.`
      )

    if (invitation.isExpired())
      throw new Exception(400, `This invitation has already expired`)

    // Revoke the invitation
    const { data: revokedInvitation, error: revokeError } =
      await db.services.invitation.revoke(invitationId, user.id)

    if (revokeError) throw new Exception(500, revokeError.message)

    res.status(200).json({
      success: true,
      data: revokedInvitation,
      message: `Invitation revoked successfully`,
    })
  },
}
