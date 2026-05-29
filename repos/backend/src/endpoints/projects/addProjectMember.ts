import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TPermission } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { InviteService } from '@TBE/services/invite'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  Exception,
  ERoleType,
  EPermScope,
  EPermAction,
  EPermResource,
  canManageRole,
  isValidEffect,
  isValidPermission,
} from '@tdsk/domain'

type TOverrideEntry = { permission: TPermission; effect: `grant` | `deny` }

/**
 * TODO: Refactor this out of the endpoint file
 * Should be in the services or middleware
 */
function validateOverrides(overrides: TOverrideEntry[]): void {
  for (const po of overrides) {
    if (!isValidPermission(po.permission))
      throw new Exception(400, `Invalid permission: ${po.permission}`)
    if (!isValidEffect(po.effect))
      throw new Exception(400, `Invalid effect: ${po.effect}. Must be 'grant' or 'deny'`)
  }
}

/**
 * TODO: Refactor this out of the endpoint file
 * Should be in the services or database
 */
async function applyOverrides(
  db: TDatabase,
  overrides: TOverrideEntry[],
  opts: { userId: string; projectId: string; grantedBy: string }
): Promise<string[]> {
  const warnings: string[] = []
  for (const po of overrides) {
    const { error: poErr } = await db.services.permissionOverride.create({
      effect: po.effect,
      userId: opts.userId,
      projectId: opts.projectId,
      grantedBy: opts.grantedBy,
      permission: po.permission,
    })
    if (poErr) {
      logger.error(`Failed to create permission override:`, poErr)
      warnings.push(`Failed to set ${po.permission} override`)
    }
  }
  return warnings
}

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

    if (permissionOverrides?.length) validateOverrides(permissionOverrides)

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

      if (existingUser) {
        const { data: isOrgMember, error: memberErr } =
          await db.services.role.isOrgMember(existingUser.id, orgId)
        if (memberErr)
          throw new Exception(500, `Failed to check org membership: ${memberErr.message}`)

        if (isOrgMember) {
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

    const { data: existingProject, error: projectError } =
      await db.services.project.get(projectId)
    if (projectError) throw new Exception(500, projectError.message)
    if (!existingProject) throw new Exception(404, `Project not found`)

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
