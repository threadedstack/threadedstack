import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { InviteService } from '@TBE/services/invite'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource, ERoleType } from '@tdsk/domain'

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

    // Check permission - requires admin+ in the org
    await checkPermission(req, EPermAction.create, EPermResource.role, { orgId })

    // Verify org exists
    const { data: org, error: orgError } = await db.services.org.get(orgId)

    if (orgError) throw new Exception(500, orgError.message)
    if (!org) throw new Exception(404, `Organization not found`)

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
