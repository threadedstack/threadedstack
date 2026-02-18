import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { ERoleType } from '@tdsk/domain'
import { logger } from '@TDB/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'

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

    if (!userId) throw new Exception(401, `Authentication required`)

    if (!orgData || !orgData.name) throw new Exception(400, `Org name is required`)

    const { data, error } = await db.services.org.create({
      ...orgData,
      ownerId: userId,
    })

    if (error) throw new Exception(500, error.message)

    // Automatically add user creator as owner
    if (data?.id) {
      const { error: roleError } = await db.services.role.create({
        userId,
        orgId: data.id,
        type: ERoleType.owner,
      })

      if (roleError) {
        logger.error(`Failed to assign owner role:`, roleError)
        await db.services.org.delete(data.id)
        throw new Exception(500, `Failed to assign owner role to organization`)
      }
    }

    res.status(201).json({ data })
  },
}
