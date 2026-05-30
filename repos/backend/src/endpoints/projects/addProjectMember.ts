import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { InviteService } from '@TBE/services/invite'
import { applyOverrides } from '@TBE/utils/auth/applyOverrides'
import { validateOverrides } from '@TBE/utils/auth/validateOverrides'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  Exception,
  ERoleType,
  EPermScope,
  PlanLimits,
  EPermAction,
  EPermResource,
  canManageRole,
  ESubscriptionTier,
} from '@tdsk/domain'

function jsonWithWarnings(
  res: Response,
  status: number,
  body: Record<string, unknown>,
  warnings: string[]
): void {
  res.status(status).json({ ...body, ...(warnings.length && { warnings }) })
}

/**
 * POST /orgs/:orgId/projects/:projectId/members - Add a member to a project
 * Creates a role entry linking the user to the project
 * Requires admin+ role to add members
 * Target user must be an org member first
 * Cannot add someone with higher role than yourself
 */
export const addProjectMember: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.manage, EPermResource.project)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId } = req.params
    const { db, config, email: ems } = req.app.locals
    const { email, userId, permissionOverrides, roleType = ERoleType.member } = req.body

    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)
    if (!userId && !email) throw new Exception(400, `Either userId or email is required`)
    if (userId && email) throw new Exception(400, `Provide userId or email, not both`)

    const validRoles = [ERoleType.member, ERoleType.admin, ERoleType.owner] as string[]
    if (!validRoles.includes(roleType as string))
      throw new Exception(
        400,
        `Invalid role type. Must be one of: ${validRoles.join(', ')}`
      )

    if (permissionOverrides?.length)
      await validateOverrides(permissionOverrides, req, orgId)

    const currentUserRole = await getUserRole(req, { orgId, projectId })
    const targetRole = roleType as ERoleType

    if (!canManageRole(currentUserRole, targetRole))
      throw new Exception(
        403,
        `You cannot add a member with ${targetRole} role. You can only add members with roles below your own.`,
        `FORBIDDEN`
      )

    if (email) {
      const { data: existingProject, error: projectError } =
        await db.services.project.get(projectId)
      if (projectError) throw new Exception(500, projectError.message)
      if (!existingProject) throw new Exception(404, `Project not found`)
      await checkPermission(req, EPermAction.create, EPermResource.role, {
        orgId,
        scopeType: EPermScope.org,
      })

      const { data: existingUser, error: userError } =
        await db.services.user.byEmail(email)
      if (userError)
        throw new Exception(500, `Failed to look up user: ${userError.message}`)

      const { data: org, error: orgError } = await db.services.org.get(orgId)
      if (orgError)
        throw new Exception(500, `Failed to look up organization: ${orgError.message}`)
      if (!org) throw new Exception(404, `Organization not found`)

      // Check seat capacity before creating any new org membership via invitation
      if (org.ownerId) {
        const { data: ownerSub, error: subErr } =
          await db.services.subscription.findByUser(org.ownerId)
        if (subErr)
          throw new Exception(
            500,
            `Failed to verify subscription status: ${subErr.message}`
          )
        const tier = (ownerSub?.tier || `free`) as ESubscriptionTier
        const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]

        if (!limits.additionalSeats && limits.seats <= 1)
          throw new Exception(
            403,
            `Your plan does not allow inviting additional members. Upgrade to a Pro or Team plan.`
          )

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

      if (existingUser) {
        const { data: isOrgMember, error: memberErr } =
          await db.services.role.isOrgMember(existingUser.id, orgId)
        if (memberErr)
          throw new Exception(500, `Failed to check org membership: ${memberErr.message}`)

        if (isOrgMember) {
          const { data: isAlreadyMember, error: memberCheckErr } =
            await db.services.role.isProjectMember(existingUser.id, projectId)
          if (memberCheckErr)
            throw new Exception(
              500,
              `Failed to check project membership: ${memberCheckErr.message}`
            )
          if (isAlreadyMember)
            throw new Exception(409, `User is already a project member`)

          const { data, error } = await db.services.role.create({
            projectId,
            userId: existingUser.id,
            type: targetRole,
          })
          if (error) throw new Exception(500, error.message)

          const warnings = permissionOverrides?.length
            ? await applyOverrides(db, permissionOverrides, {
                userId: existingUser.id,
                projectId,
                grantedBy: currentUserId,
              })
            : []

          jsonWithWarnings(res, 201, { data }, warnings)
          return
        }

        const ins = new InviteService({ db, config, email: ems })
        await ins.isMember({ user: existingUser, org })
        await ins.invited({ org, email })
        const { role: newRole, warnings } = await ins.existing({
          org,
          email,
          inviter: req.user,
          user: existingUser,
          permissionOverrides,
          roleType: ERoleType.member,
          projectRoles: [{ projectId, roleType: targetRole }],
        })
        jsonWithWarnings(
          res,
          201,
          {
            data: newRole,
            message: `User added to organization and project`,
          },
          warnings
        )
        return
      }

      const ins = new InviteService({ db, config, email: ems })
      await ins.invited({ org, email })
      const { invite, warnings: createWarnings } = await ins.create({
        org,
        email,
        expiresInDays: 7,
        inviter: req.user,
        permissionOverrides,
        roleType: ERoleType.member,
        frontendUrl: config.frontendUrl,
        projectRoles: [{ projectId, roleType: targetRole }],
      })
      jsonWithWarnings(
        res,
        201,
        {
          data: invite,
          message: `Invitation sent to ${email}`,
        },
        createWarnings
      )
      return
    }

    const { data: isOrgMember, error: orgMemberError } =
      await db.services.role.isOrgMember(userId, orgId)

    if (orgMemberError) throw new Exception(500, orgMemberError.message)

    if (!isOrgMember)
      throw new Exception(
        400,
        `User must be an organization member before being added to a project`
      )

    const { error: projectError, data: existingProject } =
      await db.services.project.get(projectId)

    if (projectError) throw new Exception(500, projectError.message)
    if (!existingProject) throw new Exception(404, `Project not found`)

    const { data: isAlreadyMember, error: memberCheckErr } =
      await db.services.role.isProjectMember(userId, projectId)

    if (memberCheckErr)
      throw new Exception(
        500,
        `Failed to check project membership: ${memberCheckErr.message}`
      )
    if (isAlreadyMember) throw new Exception(409, `User is already a project member`)

    const { data, error } = await db.services.role.create({
      projectId,
      userId,
      type: targetRole,
    })

    if (error) throw new Exception(500, error.message)

    const warnings = permissionOverrides?.length
      ? await applyOverrides(db, permissionOverrides, {
          userId,
          projectId,
          grantedBy: currentUserId,
        })
      : []

    jsonWithWarnings(res, 201, { data }, warnings)
  },
}
