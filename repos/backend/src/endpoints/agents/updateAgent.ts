import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /_/agents/:id - Update an agent
 * Can optionally update project associations by passing projectIds array
 */
export const updateAgent: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { projectIds = [], functionIds = [], providerIds = [], ...agent } = req.body

    // First get the agent to check permissions
    const { data: existingAgent, error: getError } = await db.services.agent.get(id)
    if (getError) throw new Exception(404, `Agent not found`)
    if (!existingAgent) throw new Exception(404, `Agent not found`)

    // Check permission to update agents in this org
    await checkPermission(req, EPermAction.update, EPermResource.agent, {
      orgId: existingAgent.orgId,
    })

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds } })
      : { data: [] }

    if (projErr) throw new Exception(500, projErr.message)

    // If providerIds are being changed, validate all are AI type and same org
    if (providerIds?.length) {
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
        if (provider.orgId !== existingAgent.orgId)
          throw new Exception(
            403,
            `Provider ${providerId} does not belong to organization ${existingAgent.orgId}`
          )
      }
    }

    agent.id = id
    if (projects?.length) agent.projects = projects
    if (functionIds?.length) agent.functionIds = functionIds
    if (providerIds?.length) agent.providerIds = providerIds
    const { data, error } = await db.services.agent.update(agent)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
