import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'

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

    if (!token) throw new Exception(400, `Token is required`)

    if (!user) throw new Exception(401, `You must be logged in to accept an invitation`)

    // Get invitation by token
    const { data: invitation, error: invitationError } =
      await db.services.invitation.getByToken(token)

    if (invitationError) throw new Exception(500, invitationError.message)

    if (!invitation) throw new Exception(404, `Invalid invitation token`)

    // Validate invitation status
    if (!invitation.isPending()) {
      if (invitation.isExpired()) throw new Exception(400, `This invitation has expired`)
      if (invitation.isRevoked())
        throw new Exception(400, `This invitation has been revoked`)
      if (invitation.isAccepted())
        throw new Exception(400, `This invitation has already been accepted`)

      throw new Exception(400, `This invitation is no longer valid`)
    }

    // Verify email matches (case-insensitive)
    if (invitation.email.toLowerCase() !== user.email?.toLowerCase())
      throw new Exception(
        403,
        `This invitation was sent to ${invitation.email}. You are logged in as ${user.email}.`
      )

    // Check if user is already a member
    const { data: existingRole } = await db.services.role.getOrgRole(
      user.id,
      invitation.orgId
    )

    if (existingRole)
      throw new Exception(400, `You are already a member of this organization`)

    // Create the role
    const { data: newRole, error: roleError } = await db.services.role.create({
      userId: user.id,
      orgId: invitation.orgId,
      type: invitation.roleType,
    })

    if (roleError) throw new Exception(500, roleError.message)

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
