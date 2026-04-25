import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /_/users - Create a new user (invite user to org)
 * Requires admin+ role in the org
 * Request should include orgId and initial role
 */
export const createUser: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.user)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userData = req.body
    const { orgId, role: initialRole } = userData

    if (!orgId) throw new Exception(400, `orgId is required to invite users`)
    if (!userData || !userData.email) throw new Exception(400, `Email is required`)

    const { data, error } = await db.services.user.create(userData)
    if (error) throw new Exception(500, error.message)

    // Create role for the user in the org
    if (data?.id) {
      const result = await db.services.role.create({
        orgId,
        userId: data.id,
        type: initialRole || ERoleType.member,
      })

      if (result.error)
        throw new Exception(
          500,
          `User created but role assignment failed: ${result.error.message}`
        )
    }

    res.status(201).json({ data })
  },
}
