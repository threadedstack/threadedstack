import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Project } from '@tdsk/domain'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'

/**
 * PUT /Projects/:id - Update an existing Project
 */
export const updateProject: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    res.status(200).json({})
  },
}
