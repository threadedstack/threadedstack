import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EFunLanguage } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Function as TDFunction, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/functions - Create a new function
 * Requires admin+ role in the project
 */
export const createFunction: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      name,
      content,
      language,
      agentIds,
      endpointId,
      description,
      defaultArgs,
      inputSchema,
      dependencies,
    } = req.body
    const projectId = req.params.projectId || req.body.projectId

    if (!name) throw new Exception(400, `Function name is required`)
    if (!projectId) throw new Exception(400, `Project ID is required`)
    if (!content) throw new Exception(400, `Function content is required`)

    // Check permission - requires admin+
    await checkPermission(req, EPermAction.create, EPermResource.function, {
      projectId,
    })

    try {
      const func = new TDFunction({
        name,
        content,
        projectId,
        endpointId,
        description,
        language: language || EFunLanguage.typescript,
        ...(defaultArgs && { defaultArgs }),
        ...(inputSchema && { inputSchema }),
        ...(dependencies && { dependencies }),
      })

      const { data, error } = await db.services.function.create(func)
      if (error) throw new Exception(500, error.message)

      // Set agent associations via junction table
      if (data && agentIds?.length) {
        await db.services.function.setAgents(data.id, agentIds)
        data.agentIds = agentIds
      }

      res.status(201).json({ data })
    } catch (err) {
      if (err instanceof Exception) throw err

      const message = err instanceof Error ? err.message : `Failed to create function`
      throw new Exception(500, message)
    }
  },
}
