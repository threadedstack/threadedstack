import type { Response } from 'express'
import type { Secret, TPermission } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'

/**
 * GET /secrets - List all secrets
 * Members can see metadata (name, id), admins can see values
 */
export const listSecrets: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.secret)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId } = req.params
    const { agentId, providerId } = req.query

    if (!orgId && !projectId && !agentId && !providerId)
      throw new Exception(400, `orgId, projectId, agentId, or providerId is required`)

    // For agent secrets, look up the agent to get its orgId for permission check
    let permOrgId = orgId
    if (agentId) {
      const { data: agent, error: agentErr } = await db.services.agent.get(
        agentId as string
      )
      if (agentErr)
        throw new Exception(500, `Failed to look up agent: ${agentErr.message}`)
      if (!agent) throw new Exception(404, `Agent not found`)
      permOrgId = agent.orgId
    }

    // For provider secrets, look up the provider to get its orgId for permission check
    if (providerId) {
      const { data: provider, error: providerErr } = await db.services.provider.get(
        providerId as string
      )
      if (providerErr)
        throw new Exception(500, `Failed to look up provider: ${providerErr.message}`)
      if (!provider) throw new Exception(404, `Provider not found`)
      permOrgId = provider.orgId
    }

    const { limit, offset } = parsePagination(req)

    const where: Record<string, string> = {}
    if (orgId) where.orgId = orgId
    if (projectId) where.projectId = projectId
    if (agentId) where.agentId = agentId as string
    if (providerId) where.providerId = providerId as string

    const { data, error } = await db.services.secret.list({ where, limit, offset })

    if (error) throw new Exception(500, error.message)

    const secrets: Secret[] = data || []

    // Use override-aware permission resolution to check secret:manage
    // This respects both role-based permissions and per-user overrides
    const permissions = await resolveEffectivePermissions(req, {
      orgId: permOrgId,
      projectId,
    })
    const managePermission: TPermission = `${EPermResource.secret}:${EPermAction.manage}`
    const includeValue = permissions === 'super' || permissions.has(managePermission)

    // Return sanitized for members, full for admins
    const responseData = includeValue
      ? secrets
      : secrets.map((secret) => secret.sanitize())

    res.status(200).json({ data: responseData, limit, offset })
  },
}
