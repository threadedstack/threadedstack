import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import { Exception, EProvider, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /Projects - Create a new Project
 * User must be a member of the organization to create projects
 */
export const createProject: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.project)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, providerInputs, ...projectData } = req.body
    const orgId = req.params.orgId || req.body.orgId

    if (!orgId) throw new Exception(400, `orgId is required`)

    // Validate required fields
    if (!name) throw new Exception(400, `Project name is required`)

    const pins = await db.services.provider.validate({
      orgId,
      inputs: providerInputs,
      type: [EProvider.ai, EProvider.docker, EProvider.git],
    })

    // Create the project
    const { data, error } = await db.services.project.create({
      name,
      meta: {},
      ...projectData,
      orgId,
      ...(pins?.length ? { providerInputs: pins } : {}),
    })

    if (error) throw new Exception(500, error.message)

    // Increment project quota for the org
    if (orgId && db.services.quota) {
      db.services.quota
        .increment(orgId, getBillingPeriod(), `projects`)
        .catch((err: unknown) =>
          logger.error(`[quota] Failed to increment projects for org=${orgId}:`, err)
        )
    }

    res.status(201).json({ data })
  },
}
