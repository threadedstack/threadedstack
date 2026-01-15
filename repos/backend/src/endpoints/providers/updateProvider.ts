import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Provider } from '@tdsk/domain'
import { isObj } from '@keg-hub/jsutils/isObj'
import { HttpMethods } from '@TBE/constants/values'

/**
 * PUT /Providers/:id - Update an existing Provider
 */
export const updateProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    // TODO: check user permissions
    // TODO: add code to update a provider
    const { id } = req.params
    const { db } = req.app.locals

    res.status(200).json({})
  },
}
