import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EFunLanguage } from '@tdsk/domain'
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
      projectId,
      endpointId,
      description,
      defaultArgs,
      dependencies,
    } = req.body

    if (!name) {
      res.status(400).json({ error: `Function name is required` })
      return
    }

    if (!content) {
      res.status(400).json({ error: `Function content is required` })
      return
    }

    if (!projectId) {
      res.status(400).json({ error: `Project ID is required` })
      return
    }

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
        ...(dependencies && { dependencies }),
      })

      const { data, error } = await db.services.function.create(func)
      error
        ? res.status(500).json({ error: error.message })
        : res.status(201).json({ data })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to create function`
      res.status(500).json({ error: message })
    }
  },
}
