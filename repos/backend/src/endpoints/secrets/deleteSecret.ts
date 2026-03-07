import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /secrets/:id - Delete a secret
 * Requires admin+ role
 */
export const deleteSecret: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.secret.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Secret not found`)

    // Check permission based on secret's scope - requires admin+
    await checkPermission(req, EPermAction.delete, EPermResource.secret, {
      orgId: existing.orgId,
      projectId: existing.projectId,
    })

    // Check if any providers reference this secret as their API key
    const { data: linkedProviders } = await db.services.provider.list({
      where: { secretId: id },
    })
    if (linkedProviders?.length) {
      const name = linkedProviders[0].name
      throw new Exception(
        409,
        `Cannot delete secret — it is the API key for provider "${name}". Unlink or replace it first.`
      )
    }

    const { error } = await db.services.secret.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}
