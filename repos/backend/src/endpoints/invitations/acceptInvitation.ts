import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'

/**
 * POST /_/invitations/accept - Accept an organization invitation
 * Public endpoint (requires valid token, authenticated user)
 *
 * Body: { token: string }
 *
 * Validates the invitation and creates the user's role in the organization
 */
export const acceptInvitation: TEndpointConfig = {
  path: `/accept`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { token } = req.body
    const user = req.user

    if (!token) {
      res.status(400).json({ error: 'Token is required' })
      return
    }

    if (!user) {
      res.status(401).json({ error: 'You must be logged in to accept an invitation' })
      return
    }

    // Get invitation by token
    const { data: invitation, error: invitationError } =
      await db.services.invitation.getByToken(token)

    if (invitationError) {
      res.status(500).json({ error: invitationError.message })
      return
    }

    if (!invitation) {
      res.status(404).json({ error: 'Invalid invitation token' })
      return
    }

    // Validate invitation status
    if (!invitation.isPending()) {
      if (invitation.isExpired()) {
        res.status(400).json({ error: 'This invitation has expired' })
        return
      }
      if (invitation.isRevoked()) {
        res.status(400).json({ error: 'This invitation has been revoked' })
        return
      }
      if (invitation.isAccepted()) {
        res.status(400).json({ error: 'This invitation has already been accepted' })
        return
      }

      res.status(400).json({ error: 'This invitation is no longer valid' })
      return
    }

    // Verify email matches (case-insensitive)
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
      res.status(403).json({
        error: `This invitation was sent to ${invitation.email}. You are logged in as ${user.email}.`,
      })
      return
    }

    // Check if user is already a member
    const { data: existingRole } = await db.services.role.getOrgRole(
      user.id,
      invitation.orgId
    )

    if (existingRole) {
      res.status(400).json({
        error: 'You are already a member of this organization',
      })
      return
    }

    // Create the role
    const { data: newRole, error: roleError } = await db.services.role.create({
      userId: user.id,
      orgId: invitation.orgId,
      type: invitation.roleType,
    })

    if (roleError) {
      res.status(500).json({ error: roleError.message })
      return
    }

    // Mark invitation as accepted
    const { error: acceptError } = await db.services.invitation.accept(
      invitation.id,
      user.id
    )

    // Role was created but invitation wasn't updated - log the error but don't fail
    acceptError &&
      logger.error(`Failed to mark invitation ${invitation.id} as accepted:`, acceptError)

    res.status(200).json({
      success: true,
      data: newRole,
      message: `Successfully joined the organization`,
    })
  },
}
