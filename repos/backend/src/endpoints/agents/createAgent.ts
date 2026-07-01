import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EProvider, Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/agents - Create a new agent
 * Requires orgId in body
 * Requires providerInputs array (at least one AI provider)
 * Optionally accepts projectIds array to associate with projects
 * Optionally accepts secretIds array
 * Requires admin+ role in the organization
 */
export const createAgent: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.agent)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { secretIds, projectIds = [], providerInputs, ...agent } = req.body
    const orgId = req.params.orgId || agent.orgId

    // Validate required fields
    if (!orgId)
      throw new Exception(400, `Agent must belong to an organization (orgId required)`)

    const pins = await db.services.provider.validate({
      orgId,
      type: EProvider.ai,
      inputs: providerInputs,
    })

    if (!pins?.length)
      throw new Exception(
        400,
        `Agent must have at least one provider (providerInputs required)`
      )

    // Ensure orgId is set on the agent data
    agent.orgId = orgId

    const { data: projects, error: projErr } = projectIds?.length
      ? await db.services.project.list({ where: { id: projectIds, orgId } })
      : { data: [] }

    if (projErr) throw new Exception(500, projErr.message)

    // Reject projectIds that don't belong to this org (filtered out above).
    if (projectIds?.length && (projects?.length ?? 0) !== projectIds.length) {
      const foundIds = new Set((projects || []).map((p: { id: string }) => p.id))
      const missing = projectIds.filter((pid: string) => !foundIds.has(pid))
      throw new Exception(
        403,
        `Projects do not belong to this organization: ${missing.join(', ')}`,
        `FORBIDDEN`
      )
    }

    if (secretIds?.length) {
      for (const secretId of secretIds) {
        const { data: secret, error: secretErr } = await db.services.secret.get(secretId)
        if (secretErr) throw new Exception(500, secretErr.message)
        if (!secret) throw new Exception(400, `Secret ${secretId} not found`)
        if (secret.orgId !== orgId)
          throw new Exception(
            403,
            `Secret ${secretId} does not belong to this organization`,
            `FORBIDDEN`
          )
      }
    }

    if (pins?.length) agent.providerInputs = pins
    if (projects?.length) agent.projects = projects
    if (secretIds?.length) agent.secretIds = secretIds

    const { data, error } = await db.services.agent.create(agent)

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
