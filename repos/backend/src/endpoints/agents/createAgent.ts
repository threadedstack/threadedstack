import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
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
    const { projectIds = [], ...agent } = req.body
    const orgId = req.params.orgId || agent.orgId

    // Validate required fields
    if (!orgId)
      throw new Exception(400, `Agent must belong to an organization (orgId required)`)

    if (!agent.providerId)
      throw new Exception(400, `Agent must have a provider (providerId required)`)

    // Validate that the provider exists and is an AI provider
    const { data: provider, error: provErr } = await db.services.provider.get(
      agent.providerId
    )
    if (provErr || !provider) throw new Exception(404, `Provider not found`)
    if (provider.type !== `ai`)
      throw new Exception(
        400,
        `Agent must be linked to an AI provider (got type: "${provider.type}")`
      )

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

    const { data, error } = await db.services.agent.create(agent)

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
