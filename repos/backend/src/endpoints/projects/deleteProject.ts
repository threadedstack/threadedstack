import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * DELETE /Projects/:id - Delete an Project
 */
export const deleteProject: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.project.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `Project not found` })
      return
    }

    const { data, error } = await db.services.project.delete(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data: { success: true, id } })
  },
}
