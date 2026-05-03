import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { CliSessionKeyPrefix } from '@TBE/constants/values'

// No authorize() middleware — users can only revoke their own CLI session keys (userId check).
export const revokeSessionKey: TEndpointConfig = {
  path: `/session`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const keyId = req.body?.keyId || req.query?.keyId

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!keyId) throw new Exception(400, `keyId is required`)

    const { data: apiKey, error: getErr } = await db.services.apiKey.get(keyId)
    if (getErr)
      throw new Exception(500, `Failed to look up session key: ${getErr.message}`)
    if (!apiKey) throw new Exception(404, `Session key not found`)

    if (apiKey.userId !== userId)
      throw new Exception(403, `You can only revoke your own session keys`)

    if (apiKey.orgId !== req.params.orgId)
      throw new Exception(403, `Session key does not belong to this organization`)

    if (!apiKey.name?.startsWith(CliSessionKeyPrefix))
      throw new Exception(400, `This endpoint can only revoke CLI session keys`)

    const { error: revokeErr } = await db.services.apiKey.revoke(keyId)
    if (revokeErr) throw new Exception(500, `Failed to revoke session key`)

    logger.info({
      userId,
      apiKeyId: keyId,
      message: `CLI session key revoked`,
    })

    res.status(200).json({ data: { revoked: true } })
  },
}
