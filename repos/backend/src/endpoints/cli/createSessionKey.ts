import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception, ApiKey, generateApiKey } from '@tdsk/domain'
import {
  CliSessionKeyPrefix,
  CliSessionKeyTtlDays,
  CliSessionKeyMaxPerOrg,
} from '@TBE/constants/values'

// No authorize() middleware — any authenticated org member (including viewers) can create
// session keys for themselves. This is intentionally weaker than createApiKey (admin+) because
// CLI session keys are auto-generated during browser login, scoped to the current user only.
export const createSessionKey: TEndpointConfig = {
  path: `/session`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const orgId = req.params.orgId

    if (!userId) throw new Exception(401, `Authentication required`)
    if (!orgId) throw new Exception(400, `Organization ID is required`)

    const { data: isMember } = await db.services.role.isOrgMember(userId, orgId)
    if (!isMember) throw new Exception(403, `You are not a member of this organization`)

    const { error: cleanupErr } = await db.services.apiKey.cleanupExpiredCliSessionKeys(
      userId,
      orgId,
      CliSessionKeyPrefix
    )
    if (cleanupErr)
      logger.warn({
        userId,
        orgId,
        error: cleanupErr.message,
        message: `Failed to cleanup expired CLI session keys`,
      })

    const { error: countErr, data: activeCount } =
      await db.services.apiKey.countActiveCliSessionKeys(
        userId,
        orgId,
        CliSessionKeyPrefix
      )

    if (countErr) throw new Exception(500, `Failed to check session key count`)

    if (activeCount != null && activeCount >= CliSessionKeyMaxPerOrg) {
      const { data: oldest, error: oldestErr } =
        await db.services.apiKey.findOldestCliSessionKey(
          userId,
          orgId,
          CliSessionKeyPrefix
        )

      if (oldestErr)
        logger.warn({
          userId,
          orgId,
          error: oldestErr.message,
          message: `Failed to find oldest CLI session key for rotation`,
        })

      if (oldest) {
        const { error: revokeErr } = await db.services.apiKey.revoke(oldest.id)
        if (revokeErr)
          logger.warn({
            userId,
            orgId,
            apiKeyId: oldest.id,
            error: revokeErr.message,
            message: `Failed to revoke oldest CLI session key`,
          })
      }
    }

    const { key, hash, prefix } = generateApiKey()
    const expiresAt = new Date(Date.now() + CliSessionKeyTtlDays * 24 * 60 * 60 * 1000)
    const name = `${CliSessionKeyPrefix}${new Date().toISOString().split(`T`)[0]}`

    const apiKeyData = new ApiKey({
      name,
      orgId,
      userId,
      active: true,
      keyHash: hash,
      keyPrefix: prefix,
      scopes: `write`,
      rateLimit: 100,
      expiresAt,
    })

    const { data, error } = await db.services.apiKey.create(apiKeyData)
    if (error) throw new Exception(500, error.message)

    logger.info({
      name,
      orgId,
      userId,
      apiKeyId: data.id,
      message: `CLI session key created`,
    })

    res.status(201).json({
      data: {
        key,
        id: data.id,
        orgId,
        expiresAt: expiresAt.toISOString(),
      },
    })
  },
}
