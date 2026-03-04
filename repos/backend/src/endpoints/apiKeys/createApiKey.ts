import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import {
  validateApiKey,
  validateProjectKeyPermission,
} from '@TBE/utils/auth/validateApiKey'
import { checkPermission, getUserRole } from '@TBE/utils/auth/checkPermission'
import {
  ApiKey,
  EPermAction,
  EPermResource,
  ERoleType,
  hasMinRole,
  generateApiKey,
} from '@tdsk/domain'

/**
 * POST /api-keys - Generate a new API key
 * Requires admin+ role in the org or project
 */
export const createApiKey: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const keyData = { ...req.body }

    // Exclusive arc: if projectId is in body, this is a project-scoped key
    // Otherwise, use orgId from URL params for org-scoped key
    if (!keyData.projectId) keyData.orgId = req.params.orgId

    const { valid, error } = validateApiKey(keyData)
    if (!valid || error) throw new Exception(400, error)

    const { name, orgId, scopes, projectId, expiresAt, rateLimit } = keyData

    // Check permission based on scope type
    if (projectId) {
      // Project-scoped key: check project or org-level permission
      // Org admins/owners can manage project keys even without explicit project membership
      await checkPermission(req, EPermAction.create, EPermResource.apiKey, {
        projectId,
        orgId: req.params.orgId,
      })
    } else {
      // Org-scoped key: check org-level permission
      await checkPermission(req, EPermAction.create, EPermResource.apiKey, { orgId })
    }

    // Resolve target userId
    let targetUserId = req.user?.id
    if (keyData.userId && keyData.userId !== req.user?.id) {
      if (projectId) {
        // Project-scoped: project admin+ can create keys for project members
        const callerRole = await getUserRole(req, { projectId })
        const isOrgAdmin = req.params.orgId
          ? hasMinRole(
              await getUserRole(req, { orgId: req.params.orgId }),
              ERoleType.admin
            )
          : false

        const permCheck = validateProjectKeyPermission({
          requesterRole: callerRole,
          requesterUserId: req.user?.id || ``,
          targetUserId: keyData.userId,
          requestedScopes: scopes || `read`,
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
        // Org-scoped: owner+ can create keys for org members
        const callerRole = await getUserRole(req, { orgId })
        if (!hasMinRole(callerRole, ERoleType.owner))
          throw new Exception(
            403,
            `Only owners and super admins can create API keys for other users`
          )

        const { data: isMember } = await db.services.role.isOrgMember(
          keyData.userId,
          orgId
        )
        if (!isMember)
          throw new Exception(400, `Target user is not a member of this organization`)
      }

      targetUserId = keyData.userId
    }

    try {
      const { key, hash, prefix } = generateApiKey()
      const apiKeyData = new ApiKey({
        name,
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

      const { data, error } = await db.services.apiKey.create(apiKeyData)

      if (error) throw new Exception(500, error.message)

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
