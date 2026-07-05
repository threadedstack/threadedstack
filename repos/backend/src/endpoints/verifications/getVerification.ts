import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/verifications/:verificationId - Fetch one verification (org-scoped).
 */
export const getVerification: TEndpointConfig = {
  path: `/:verificationId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.verification)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, verificationId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)
    if (!verificationId) throw new Exception(400, `verificationId is required`)

    const { data, error } = await db.services.verification.get(verificationId)
    if (error) throw new Exception(500, error.message)
    if (!data || data.orgId !== orgId) throw new Exception(404, `Verification not found`)

    res.json({ data })
  },
}
