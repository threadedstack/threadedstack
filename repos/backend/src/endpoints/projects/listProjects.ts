import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /Projects - List all Projects
 */
export const listProjects: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.query

    const { data, error } = await db.services.project.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    let pros = data || []
    if (projectId) pros = pros.filter((e: any) => e.projectId === projectId)

    res.status(200).json({ data: pros })
  },
}
