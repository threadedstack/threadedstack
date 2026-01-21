import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /_/invitations/:invitationId - Revoke an invitation
 * Requires admin+ role in the org
 *
 * Only pending invitations can be revoked
 */
export const revokeInvitation: TEndpointConfig = {
  path: `/:invitationId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { invitationId } = req.params
    const user = req.user

    if (!user) {
      res.status(401).json({ error: 'You must be logged in to revoke an invitation' })
      return
    }

    // Get the invitation
    const { data: invitation, error: invitationError } =
      await db.services.invitation.get(invitationId)

    if (invitationError) {
      res.status(500).json({ error: invitationError.message })
      return
    }

    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found' })
      return
    }

    // Check permission - requires admin+ in the org
    await checkPermission(req, EPermAction.delete, EPermResource.role, {
      orgId: invitation.orgId,
    })

    // Validate invitation can be revoked
    if (invitation.isRevoked()) {
      res.status(400).json({ error: 'This invitation has already been revoked' })
      return
    }

    if (invitation.isAccepted()) {
      res.status(400).json({
        error:
          'This invitation has already been accepted. Use the role management endpoints to remove the user.',
      })
      return
    }

    if (invitation.isExpired()) {
      res.status(400).json({ error: 'This invitation has already expired' })
      return
    }

    // Revoke the invitation
    const { data: revokedInvitation, error: revokeError } =
      await db.services.invitation.revoke(invitationId, user.id)

    if (revokeError) {
      res.status(500).json({ error: revokeError.message })
      return
    }

    res.status(200).json({
      success: true,
      data: revokedInvitation,
      message: 'Invitation revoked successfully',
    })
  },
}
