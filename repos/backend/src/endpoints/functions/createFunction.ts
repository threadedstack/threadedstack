import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EFunLanguage } from '@tdsk/domain'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { Function as FunctionModel, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/functions - Create a new function
 * Requires admin+ role in the project
 */
export const createFunction: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.function)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const {
      name,
      content,
      language,
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

    const func = new FunctionModel({
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

    res.status(201).json({ data })
  },
}
