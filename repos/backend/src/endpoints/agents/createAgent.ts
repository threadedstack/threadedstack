import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /_/agents - Create a new agent
 * Requires orgId in body
 * Optionally accepts projectIds array to associate with projects
 * Requires admin+ role in the organization
 */
export const createAgent: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      projectIds = [],
      secretIds,
      providerIds: rawProviderIds = [],
      providers: providersWithPriority,
      ...agent
    } = req.body
    const orgId = req.params.orgId || agent.orgId

    // Support both formats: providerIds[] (ordered array) or providers[{id, priority}]
    const providerIds = providersWithPriority?.length
      ? providersWithPriority
          .sort(
            (a: { priority?: number }, b: { priority?: number }) =>
              (a.priority ?? 0) - (b.priority ?? 0)
          )
          .map((p: { id: string }) => p.id)
      : rawProviderIds

    // Validate required fields
    if (!orgId)
      throw new Exception(400, `Agent must belong to an organization (orgId required)`)

    if (!providerIds.length)
      throw new Exception(
        400,
        `Agent must have at least one provider (providerIds or providers required)`
      )

    // Validate all providers exist, are AI type, and belong to the same org
    for (const providerId of providerIds) {
      const { data: provider, error: provErr } =
        await db.services.provider.get(providerId)
      if (provErr || !provider)
        throw new Exception(404, `Provider ${providerId} not found`)
      if (provider.type !== `ai`)
        throw new Exception(
          400,
          `Agent must be linked to AI providers (provider ${providerId} has type: "${provider.type}")`
        )
      if (provider.orgId !== orgId)
        throw new Exception(
          403,
          `Provider ${providerId} does not belong to organization ${orgId}`
        )
    }

    // Ensure orgId is set on the agent data
    agent.orgId = orgId

    // Check permission to create agents in this org
    await checkPermission(req, EPermAction.create, EPermResource.agent, {
      orgId,
    })

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds } })
      : { data: [] }

    if (projErr) throw new Exception(500, projErr.message)
    if (projects?.length) agent.projects = projects
    if (providerIds?.length) agent.providerIds = providerIds
    if (secretIds?.length) agent.secretIds = secretIds

    const { data, error } = await db.services.agent.create(agent)

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
