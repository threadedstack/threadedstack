import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/users - Create a new user (invite user to org)
 * Requires admin+ role in the org
 * Request should include orgId and initial role
 */
export const createUser: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userData = req.body
    const { orgId, role: initialRole } = userData

    if (!orgId) {
      res.status(400).json({ error: `orgId is required to invite users` })
      return
    }

    if (!userData || !userData.email) {
      res.status(400).json({ error: `Email is required` })
      return
    }

    await checkPermission(req, EPermAction.create, EPermResource.user, { orgId })

    const { data, error } = await db.services.user.create(userData)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    // Create role for the user in the org
    if (data?.id) {
      const result = await db.services.role.create({
        orgId,
        userId: data.id,
        type: initialRole || ERoleType.member,
      })

      if (result.error) {
        res
          .status(500)
          .json({
            error: `User created but role assignment failed: ${result.error.message}`,
          })
        return
      }
    }

    res.status(201).json({ data })
  },
}
