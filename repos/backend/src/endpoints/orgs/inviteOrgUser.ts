import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { InviteService } from '@TBE/services/invite'
import { authorize } from '@TBE/middleware/authorize'
import {
  Exception,
  ERoleType,
  PlanLimits,
  EPermAction,
  EPermResource,
  ESubscriptionTier,
} from '@tdsk/domain'

type TOrgReq = {
  orgId: string
}

export type TValidate = {
  roleType: string
  email: string
  expiresInDays?: number
}

/**
 * POST /_/orgs/:orgId/users/invite - Invite user to org
 * Requires admin+ role in the org
 *
 * Body: { email: string, roleType: string, expiresInDays?: number }
 *
 * Behavior:
 * - If user exists: Create role immediately + send notification email
 * - If user doesn't exist: Create invitation + send invitation email
 */
export const inviteOrgUser: TEndpointConfig = {
  path: `/:orgId/users/invite`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.role)],
  action: async (req: TRequest<TOrgReq, TValidate>, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { email, roleType, expiresInDays = 7 } = req.body
    const { db, config, email: ems } = req.app.locals

    if (!email) throw new Exception(400, `Email is required`)
    if (!roleType) throw new Exception(400, `Role type is required`)

    const validRoles = Object.values(ERoleType) as string[]
    if (!validRoles.includes(roleType))
      throw new Exception(
        400,
        `Invalid role type. Must be one of: ${validRoles.join(', ')}`
      )

    // Validate expiration days
    if (expiresInDays < 1 || expiresInDays > 30)
      throw new Exception(400, `expiresInDays must be between 1 and 30`)

    // Verify org exists
    const { data: org, error: orgError } = await db.services.org.get(orgId)

    if (orgError) throw new Exception(500, orgError.message)
    if (!org) throw new Exception(404, `Organization not found`)

    // Check seat capacity based on owner's subscription tier
    if (org.ownerId) {
      const { data: ownerSub } = await db.services.subscription.findByUser(org.ownerId)
      const tier = (ownerSub?.tier || `free`) as ESubscriptionTier
      const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]

      // Free and Solo tiers do not allow additional members
      if (!limits.additionalSeats && limits.seats <= 1)
        throw new Exception(
          403,
          `Your plan does not allow inviting additional members. Upgrade to a Pro or Team plan.`
        )

      // Check if adding a member would exceed seat capacity
      if (limits.seats !== -1) {
        const { data: members, error: membersError } =
          await db.services.role.getOrgMembers(orgId)
        if (membersError)
          throw new Exception(
            500,
            `Failed to verify seat capacity: ${membersError.message}`
          )
        const currentMembers = Array.isArray(members) ? members.length : 0
        if (currentMembers >= limits.seats)
          throw new Exception(
            403,
            `Seat limit reached (${currentMembers}/${limits.seats}). Upgrade your plan to add more members.`
          )
      }
    }

    const { data: user, error: userError } = await db.services.user.byEmail(email)

    if (userError) throw new Exception(500, userError.message)

    const ins = new InviteService({
      db,
      config,
      email: ems,
    })

    // Check for existing pending invitation based on email
    await ins.invited({ org, email })

    // CASE 1: User exists - create role immediately and send notification
    if (user) {
      // If user exists, check if user is already a member
      await ins.isMember({ user, org })

      const newRole = await ins.existing({
        org,
        user,
        email,
        roleType,
        inviter: req.user,
      })

      res.status(201).json({
        data: newRole,
        message: `User ${email} has been added to the organization`,
      })
      return
    }

    // CASE 2: User doesn't exist - create invitation and send email
    const invite = await ins.create({
      org,
      roleType,
      email,
      expiresInDays,
      inviter: req.user,
      frontendUrl: config.frontendUrl,
    })

    res.status(201).json({
      data: invite,
      message: `Invitation sent to ${email}`,
    })
  },
}
