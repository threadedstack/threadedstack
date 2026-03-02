import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
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
    const { name, ...projectData } = req.body
    const orgId = req.params.orgId || req.body.orgId

    if (!orgId) throw new Exception(400, `orgId is required`)

    // Validate required fields
    if (!name) throw new Exception(400, `Project name is required`)

    // Check permission - user must be member of org to create project
    await checkPermission(req, EPermAction.create, EPermResource.project, { orgId })

    // Create the project
    const { data, error } = await db.services.project.create({
      name,
      meta: {},
      ...projectData,
      orgId,
    })

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}
