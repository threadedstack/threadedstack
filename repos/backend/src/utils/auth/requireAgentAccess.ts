import type { TRequest } from '@TBE/types'

import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { Exception, ERoleType, hasMinRole } from '@tdsk/domain'

/**
 * Enforce agent access based on project membership.
 * Org admins+ bypass this check and can access any agent.
 * Non-admin org members can only access agents that belong to
 * at least one project they are a member of.
 *
 * @param req - Express request with user and app context
 * @param agentId - The agent ID to check access for
 * @param orgId - The org the agent belongs to
 * @param agentData - Optional pre-fetched agent data to avoid re-fetching
 */
export const requireAgentAccess = async (
  req: TRequest,
  agentId: string,
  orgId: string,
  agentData?: { projects?: Array<{ id: string }> }
): Promise<void> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) throw new Exception(401, `Authentication required`, `UNAUTHORIZED`)

  // Admins+ bypass project-level access checks
  const userRole = await getUserRole(req, { orgId })
  if (hasMinRole(userRole, ERoleType.admin)) return

  // Fetch agent if not provided
  let agent = agentData
  if (!agent) {
    const { data, error } = await db.services.agent.get(agentId)
    if (error || !data) throw new Exception(404, `Agent not found`)
    agent = data
  }

  // Agents with no projects are only accessible by admins+
  const projects = agent.projects || []
  if (projects.length === 0) {
    throw new Exception(
      403,
      `Access denied: agent is not assigned to any project`,
      `FORBIDDEN`
    )
  }

  // Check if user is a member of any of the agent's projects
  const { data: userProjectIds, error: projErr } =
    await db.services.role.getUserProjects(userId)
  if (projErr) throw new Exception(500, `Failed to retrieve user projects`)

  const userProjectSet = new Set(userProjectIds || [])
  const hasAccess = projects.some((p) => userProjectSet.has(p.id))

  if (!hasAccess) {
    throw new Exception(
      403,
      `Access denied: you are not a member of any project this agent belongs to`,
      `FORBIDDEN`
    )
  }
}
