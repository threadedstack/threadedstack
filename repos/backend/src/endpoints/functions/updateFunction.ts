import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'
import { Function as FunctionModel, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /_/functions/:id - Update function
 * Requires admin+ role in the project
 */
export const updateFunction: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
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

    const existingFunc = await requireResourceWithPermission(
      req,
      db.services.function,
      id,
      EPermAction.update,
      EPermResource.function,
      `Function`,
      (data) => ({ orgId: req.params.orgId, projectId: data.projectId })
    )

    const func = new FunctionModel({
      ...existingFunc,
      ...(name && { name }),
      ...(content && { content }),
      ...(language && { language }),
      ...(endpointId !== undefined && { endpointId }),
      ...(description !== undefined && { description }),
      ...(defaultArgs !== undefined && { defaultArgs }),
      ...(inputSchema !== undefined && { inputSchema }),
      ...(dependencies !== undefined && { dependencies }),
    })

    const { data, error } = await db.services.function.update(func)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}
