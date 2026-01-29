import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Function as TDFunction, EPermAction, EPermResource } from '@tdsk/domain'

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
    const { name, description, content, language, defaultArgs, dependencies } = req.body

    const { data: existingFunc, error: fetchError } = await db.services.function.get(id)

    if (fetchError) throw new Exception(500, fetchError.message)

    if (!existingFunc) throw new Exception(404, `Function not found`)

    // Check permission
    await checkPermission(req, EPermAction.update, EPermResource.function, {
      projectId: existingFunc.projectId,
    })

    const func = new TDFunction({
      ...existingFunc,
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(content && { content }),
      ...(language && { language }),
      ...(defaultArgs !== undefined && { defaultArgs }),
      ...(dependencies !== undefined && { dependencies }),
    })

    const { data, error } = await db.services.function.update(func)
    if (error) throw new Exception(500, error.message)
    res.status(200).json({ data })
  },
}
