import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import {
  validateApiKey,
  validateApiKeyRole,
  validateProjectKeyPermission,
} from '@TBE/utils/auth/validateApiKey'
import {
  ApiKey,
  ERoleType,
  hasMinRole,
  EPermAction,
  EPermResource,
  generateApiKey,
} from '@tdsk/domain'

/**
 * POST /api-keys - Generate a new API key
 * Requires admin+ role in the org or project
 */
export const createApiKey: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.apiKey)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const keyData = { ...req.body }

    if (!keyData.projectId) keyData.orgId = req.params.orgId

    const { valid, error } = validateApiKey(keyData)
    if (!valid || error) throw new Exception(400, error)

    const { name, orgId, scopes, projectId, expiresAt, rateLimit } = keyData
    const role = keyData.role || `viewer`

    // Resolve target userId and enforce permissions
    const orgRole = await getUserRole(req, { orgId: orgId || req.params.orgId })

    let targetUserId = req.user?.id
    if (keyData.userId && keyData.userId !== req.user?.id) {
      if (projectId) {
        const projectRole = await getUserRole(req, { projectId })
        const callerRole = projectRole || orgRole
        const isOrgAdmin = hasMinRole(orgRole, ERoleType.admin)

        const permCheck = validateProjectKeyPermission({
          requesterRole: callerRole,
          requesterUserId: req.user?.id || ``,
          targetUserId: keyData.userId,
          requestedRole: role,
          isOrgAdmin,
        })
        if (!permCheck.valid) throw new Exception(403, permCheck.error)

        const { data: isMember } = await db.services.role.isProjectMember(
          keyData.userId,
          projectId
        )
        if (!isMember)
          throw new Exception(400, `Target user is not a member of this project`)
      } else {
        if (!hasMinRole(orgRole, ERoleType.admin))
          throw new Exception(403, `Only admins can create API keys for other users`)

        const roleCheck = validateApiKeyRole(role, orgRole)
        if (!roleCheck.valid) throw new Exception(403, roleCheck.error)

        const { data: isMember } = await db.services.role.isOrgMember(
          keyData.userId,
          orgId
        )
        if (!isMember)
          throw new Exception(400, `Target user is not a member of this organization`)
      }

      targetUserId = keyData.userId
    } else {
      const callerRole = projectId
        ? (await getUserRole(req, { projectId })) || orgRole
        : orgRole

      const roleCheck = validateApiKeyRole(role, callerRole)
      if (!roleCheck.valid) throw new Exception(403, roleCheck.error)
    }

    try {
      const { key, hash, prefix } = generateApiKey()
      const apiKeyData = new ApiKey({
        name,
        role,
        active: true,
        keyHash: hash,
        keyPrefix: prefix,
        userId: targetUserId,
        scopes: scopes || `read`,
        rateLimit: rateLimit || 100,
        ...(orgId && { orgId }),
        ...(projectId && { projectId }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
      })

      const { data, error: createErr } = await db.services.apiKey.create(apiKeyData)

      if (createErr) throw new Exception(500, createErr.message)

      logger.info({
        name,
        orgId,
        projectId,
        apiKeyId: data.id,
        message: `New API Key created`,
      })

      /**
       * **IMPORTANT** - Return the `key` ONLY on creation - it will never be shown again
       */
      data.key = key
      res.status(201).json({
        data,
        warning: `Store this API key securely. It will not be shown again.`,
      })
    } catch (err) {
      if (err instanceof Exception) throw err
      const message = err instanceof Error ? err.message : `Failed to create API key`
      throw new Exception(500, message)
    }
  },
}
