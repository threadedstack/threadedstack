import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /orgs - Create a new org
 * Any authenticated user can create an org (member+ permission)
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
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (!orgData || !orgData.name) {
      res.status(400).json({ error: `Org name is required` })
      return
    }

    // Check permission (member+ can create orgs)
    await checkPermission(req, EPermAction.create, EPermResource.org)

    const { data, error } = await db.services.org.create(orgData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    // Automatically add creator as owner
    if (data?.id) {
      const { error: roleError } = await db.services.role.create({
        userId,
        orgId: data.id,
        type: ERoleType.owner,
      })

      if (roleError) {
        // Log error but don't fail the org creation
        console.error('Failed to assign owner role:', roleError)
      }
    }

    res.status(201).json({ data })
  },
}
