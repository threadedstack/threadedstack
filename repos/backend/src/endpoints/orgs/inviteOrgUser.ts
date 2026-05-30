import type { Response } from 'express'
import type { TRoleType, TPermission } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { InviteService } from '@TBE/services/invite'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'
import {
  Exception,
  ERoleType,
  PlanLimits,
  EPermAction,
  EPermResource,
  canManageRole,
  isValidEffect,
  isValidPermission,
  ESubscriptionTier,
} from '@tdsk/domain'

type TOrgReq = {
  orgId: string
}

export type TValidate = {
  email: string
  roleType: string
  expiresInDays?: number
  projectRoles?: Array<{ projectId: string; roleType: string }>
  permissionOverrides?: Array<{
    reason?: string
    expiresAt?: string
    permission: string
    projectId?: string
    effect: `grant` | `deny`
  }>
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
    const { email, roleType, expiresInDays = 7, projectRoles } = req.body
    const permissionOverrides = req.body.permissionOverrides?.map((po) => ({
      ...po,
      permission: po.permission as TPermission,
    }))
    const { db, config, email: ems } = req.app.locals

    if (!email) throw new Exception(400, `Email is required`)
    if (!roleType) throw new Exception(400, `Role type is required`)

    const validRoles = [ERoleType.member, ERoleType.admin, ERoleType.owner] as string[]
    if (!validRoles.includes(roleType))
      throw new Exception(
        400,
        `Invalid role type. Must be one of: ${validRoles.join(', ')}`
      )

    const currentUserRole = await getUserRole(req, { orgId })
    if (!canManageRole(currentUserRole, roleType as ERoleType))
      throw new Exception(
        403,
        `You cannot invite a user with a role equal to or above your own`,
        `FORBIDDEN`
      )

    // Validate expiration days
    if (expiresInDays < 1 || expiresInDays > 30)
      throw new Exception(400, `expiresInDays must be between 1 and 30`)

    if (projectRoles?.length) {
      const prValidRoles = [
        ERoleType.member,
        ERoleType.admin,
        ERoleType.owner,
      ] as string[]
      for (const pr of projectRoles) {
        if (!prValidRoles.includes(pr.roleType))
          throw new Exception(400, `Invalid project role type: ${pr.roleType}`)

        const { data: project, error: projErr } = await db.services.project.get(
          pr.projectId
        )
        if (projErr)
          throw new Exception(500, `Failed to verify project: ${projErr.message}`)
        if (!project) throw new Exception(400, `Project not found: ${pr.projectId}`)
        if (project.orgId !== orgId)
          throw new Exception(
            400,
            `Project ${pr.projectId} does not belong to this organization`
          )
      }
    }

    if (permissionOverrides?.length) {
      const callerPerms = permissionOverrides.some((po) => po.effect === 'grant')
        ? await resolveEffectivePermissions(req, { orgId })
        : null
      for (const po of permissionOverrides) {
        if (!isValidPermission(po.permission as string))
          throw new Exception(400, `Invalid permission: ${po.permission}`)
        if (!isValidEffect(po.effect))
          throw new Exception(
            400,
            `Invalid effect: ${po.effect}. Must be 'grant' or 'deny'`
          )
        if (po.effect === `grant`) {
          if (!callerPerms)
            throw new Exception(500, `Failed to resolve caller permissions`)
          if (callerPerms !== 'super' && !callerPerms.has(po.permission)) {
            throw new Exception(
              403,
              `Cannot grant a permission you do not have: ${po.permission}`,
              `FORBIDDEN`
            )
          }
        }
      }
    }

    // Verify org exists
    const { data: org, error: orgError } = await db.services.org.get(orgId)

    if (orgError) throw new Exception(500, orgError.message)
    if (!org) throw new Exception(404, `Organization not found`)

    // Check seat capacity based on owner's subscription tier
    if (org.ownerId) {
      const { data: ownerSub, error: subErr } = await db.services.subscription.findByUser(
        org.ownerId
      )
      if (subErr)
        throw new Exception(
          500,
          `Failed to verify subscription status: ${subErr.message}`
        )
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

      const { role: newRole, warnings } = await ins.existing({
        org,
        user,
        email,
        inviter: req.user,
        permissionOverrides,
        roleType: roleType as TRoleType,
        projectRoles: projectRoles as Array<{ projectId: string; roleType: TRoleType }>,
      })

      res.status(201).json({
        data: newRole,
        message: `User ${email} has been added to the organization`,
        ...(warnings?.length && { warnings }),
      })
      return
    }

    // CASE 2: User doesn't exist - create invitation and send email
    const { invite, warnings: createWarnings } = await ins.create({
      org,
      email,
      expiresInDays,
      inviter: req.user,
      permissionOverrides,
      adminUrl: config.urls.admin,
      threadsUrl: config.urls.threads,
      roleType: roleType as TRoleType,
      projectRoles: projectRoles as Array<{ projectId: string; roleType: TRoleType }>,
    })

    res.status(201).json({
      data: invite,
      message: `Invitation sent to ${email}`,
      ...(createWarnings?.length && { warnings: createWarnings }),
    })
  },
}
