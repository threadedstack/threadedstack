import type { Response } from 'express'
import type { Secret } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission, getUserRole } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource, canAccessSecretValue } from '@tdsk/domain'

/**
 * GET /secrets - List all secrets
 * Members can see metadata (name, id), admins can see values
 */
export const listSecrets: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId, agentId } = req.query

    if (!orgId && !projectId && !agentId)
      throw new Exception(400, `orgId, projectId, or agentId query parameter required`)

    // For agent secrets, look up the agent to get its orgId for permission check
    let permOrgId = orgId as string | undefined
    if (agentId) {
      const { data: agent } = await db.services.agent.get(agentId as string)
      if (!agent) throw new Exception(404, `Agent not found`)
      permOrgId = agent.orgId
    }

    // Check permission based on scope
    await checkPermission(req, EPermAction.read, EPermResource.secret, {
      orgId: permOrgId,
      projectId: projectId as string | undefined,
    })

    const { limit, offset } = parsePagination(req)

    const where: Record<string, string> = {}
    if (orgId) where.orgId = orgId as string
    if (projectId) where.projectId = projectId as string
    if (agentId) where.agentId = agentId as string

    const { data, error } = await db.services.secret.list({ where, limit, offset })

    if (error) throw new Exception(500, error.message)

    const secrets: Secret[] = data || []

    // Check if user can see secret values
    const userRole = await getUserRole(req, {
      orgId: permOrgId,
      projectId: projectId as string | undefined,
    })
    const includeValue = canAccessSecretValue(userRole)

    // Return sanitized for members, full for admins
    const responseData = includeValue
      ? secrets
      : secrets.map((secret) => secret.sanitize())

    res.status(200).json({ data: responseData, limit, offset })
  },
}
