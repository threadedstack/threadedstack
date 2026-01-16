import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'
import { logger } from '@TDB/utils/logger'

/**
 * POST /orgs - Create a new org
 * Any authenticated user can create an org
 * Creator is automatically assigned 'owner' role
 */
export const createOrg: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgData = req.body
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    if (!orgData || !orgData.name) {
      res.status(400).json({ error: `Org name is required` })
      return
    }

    const { data, error } = await db.services.org.create(orgData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    // Automatically add user creator as owner
    if (data?.id) {
      const { error: roleError } = await db.services.role.create({
        userId,
        orgId: data.id,
        type: ERoleType.owner,
      })

      roleError && logger.error('Failed to assign owner role:', roleError)
    }

    res.status(201).json({ data })
  },
}
