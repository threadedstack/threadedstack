import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception, PlanLimits, ESubscriptionTier } from '@tdsk/domain'
import { applyInviteRolesAndOverrides } from '@TBE/utils/auth/applyInviteRolesAndOverrides'

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
    const { data: existingRole, error: roleCheckErr } = await db.services.role.getOrgRole(
      user.id,
      invitation.orgId
    )
    if (roleCheckErr)
      throw new Exception(500, `Failed to verify org membership: ${roleCheckErr.message}`)

    if (existingRole) {
      const alreadyMemberWarnings: string[] = []
      await db.services.invitation.accept(invitation.id, user.id)
      await applyInviteRolesAndOverrides(db, invitation, user.id, alreadyMemberWarnings)
      res.status(200).json({
        success: true,
        data: existingRole,
        message: `You are already a member of this organization`,
        ...(alreadyMemberWarnings.length && { warnings: alreadyMemberWarnings }),
      })
      return
    }

    // Create the role
    const { data: newRole, error: roleError } = await db.services.role.create({
      userId: user.id,
      orgId: invitation.orgId,
      type: invitation.roleType,
    })

    if (roleError) throw new Exception(500, roleError.message)

    const warnings: string[] = []

    await applyInviteRolesAndOverrides(db, invitation, user.id, warnings)

    const { error: acceptError } = await db.services.invitation.accept(
      invitation.id,
      user.id
    )

    if (acceptError) {
      logger.error(`Failed to mark invitation ${invitation.id} as accepted:`, acceptError)
      throw new Exception(
        500,
        `Failed to complete invitation acceptance. Please try again.`
      )
    }

    // Update seat quantity on Stripe if this member pushes past included seats
    try {
      const { data: org, error: orgErr } = await db.services.org.get(invitation.orgId)
      if (orgErr)
        logger.error(
          `[acceptInvitation] Org lookup failed for ${invitation.orgId}:`,
          orgErr.message
        )
      if (org?.ownerId) {
        const { data: ownerSub, error: subErr } =
          await db.services.subscription.findByUser(org.ownerId)
        if (subErr)
          logger.error(
            `[acceptInvitation] Subscription lookup failed for owner ${org.ownerId}:`,
            subErr.message
          )
        if (ownerSub?.stripeSubscriptionId) {
          const tier = (ownerSub.tier || `free`) as ESubscriptionTier
          const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]
          if (limits.additionalSeats) {
            const { data: members, error: membersErr } =
              await db.services.role.getOrgMembers(invitation.orgId)
            if (membersErr)
              logger.error(
                `[acceptInvitation] Failed to get org members for seat update:`,
                membersErr
              )

            const totalMembers = membersErr ? 0 : members?.length || 1
            if (!membersErr && totalMembers > limits.seats) {
              const paidSeats = Math.max(0, totalMembers - limits.seats)
              await req.app.locals.payments.service.updateSeatQuantity(
                ownerSub.stripeSubscriptionId,
                paidSeats
              )
            }
          }
        }
      }
    } catch (seatErr) {
      logger.error(`Failed to update seat quantity after invitation acceptance:`, seatErr)
    }

    res.status(200).json({
      success: true,
      data: newRole,
      message: `Successfully joined the organization`,
      ...(warnings.length && { warnings }),
    })
  },
}
