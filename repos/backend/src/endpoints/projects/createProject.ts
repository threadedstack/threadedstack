import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Project } from '@tdsk/domain'
import { HttpMethods } from '@TBE/constants/values'

/**
 * POST /Projects - Create a new Project
 */
export const createProject: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    res.status(201).json({ data: {} })
  },
}
