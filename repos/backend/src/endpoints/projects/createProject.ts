import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /Projects - Create a new Project
 * User must be a member of the organization to create projects
 */
export const createProject: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, ...projectData } = req.body

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' })
      return
    }

    // Check permission - user must be member of org to create project
    await checkPermission(req, EPermAction.create, EPermResource.project, { orgId })

    // Create the project
    const { data, error } = await db.services.project.create({
      ...projectData,
      orgId,
    })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}
