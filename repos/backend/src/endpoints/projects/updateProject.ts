import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EProvider, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /Projects/:id - Update an existing Project
 * User must be a member of the organization to update projects
 */
export const updateProject: TEndpointConfig = {
  path: `/:projectId`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.project)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { projectId } = req.params
    const { db } = req.app.locals
    const { name, description, providerInputs } = req.body

    // First get the project to find its orgId
    const { data: existing, error: getError } = await db.services.project.get(projectId)

    if (getError) throw new Exception(500, getError.message)

    if (!existing) throw new Exception(404, `Project not found`)

    const pins = await db.services.provider.validate({
      orgId: existing.orgId,
      inputs: providerInputs,
      type: [EProvider.ai, EProvider.docker, EProvider.git],
    })

    // Update the project
    const { data, error } = await db.services.project.update({
      id: projectId,
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(pins !== undefined && { providerInputs: pins }),
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
