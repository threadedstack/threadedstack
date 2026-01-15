import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Provider } from '@tdsk/domain'
import { HttpMethods } from '@TBE/constants/values'

/**
 * POST /Providers - Create a new Provider
 */
export const createProvider: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    // TODO: check user permissions
    // TODO: add code to create provider

    res.status(201).json({ data: {} })
  },
}
