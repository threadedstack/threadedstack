import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TPermission } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'
import { validateApiKey, validateApiKeyPermissions } from '@TBE/utils/auth/validateApiKey'
import {
  ApiKey,
  EPermScope,
  EPermAction,
  EPermResource,
  generateApiKey,
  filterPermissionsByScope,
} from '@tdsk/domain'

/**
 * Validate that requested permissions are a subset of the target's effective permissions.
 * No-ops when there are no requested permissions or target is a super admin.
 *
 * `targetUserId` is forwarded as an explicit parameter rather than spread
 * onto a copy of `req` — spreading an Express `Request` drops prototype
 * getters (notably `req.app`), which crashes the downstream lookup.
 */
const validatePermissionsSubset = async (
  req: TRequest,
  requestedPermissions: TPermission[],
  context: { orgId?: string; projectId?: string },
  targetUserId?: string
): Promise<void> => {
  if (requestedPermissions.length === 0) return

  const targetPerms = await resolveEffectivePermissions(req, context, targetUserId)
  if (targetPerms === 'super') return

  const permCheck = validateApiKeyPermissions(requestedPermissions, targetPerms)
  if (!permCheck.valid) throw new Exception(403, permCheck.error)
}

/**
 * POST /api-keys - Generate a new API key
 * Any member can create a key for themselves; creating for another user requires apiKey:manage
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

    const { name, orgId, projectId, expiresAt, rateLimit } = keyData
    const requestedPermissions: TPermission[] = keyData.permissions || []
    const effectiveOrgId = orgId || req.params.orgId
    const scopeContext = projectId
      ? { projectId, orgId: effectiveOrgId }
      : { orgId: effectiveOrgId }

    if (projectId && requestedPermissions.length > 0) {
      const projectPerms = new Set(
        filterPermissionsByScope(requestedPermissions, EPermScope.project)
      )
      const outOfScope = requestedPermissions.filter((p) => !projectPerms.has(p))
      if (outOfScope.length > 0)
        throw new Exception(
          400,
          `These permissions are not valid for a project-scoped key: ${outOfScope.join(', ')}`
        )
    }

    let targetUserId = req.user?.id
    if (keyData.userId && keyData.userId !== req.user?.id) {
      // Cross-user key creation requires apiKey:manage permission
      const callerPermissions = await resolveEffectivePermissions(req, {
        orgId: effectiveOrgId,
        projectId,
      })
      if (callerPermissions !== 'super') {
        const managePermission: TPermission = `${EPermResource.apiKey}:${EPermAction.manage}`
        if (!callerPermissions.has(managePermission))
          throw new Exception(403, `Only admins can create API keys for other users`)

        // Bound the requested permissions by the CALLER's own effective
        // (key-intersected) permissions — a key can never mint a key more
        // powerful than itself, even when creating for a higher-privileged
        // target user. The subset-against-target check still runs below, so
        // the new key is bounded by BOTH the caller and the target.
        const callerCheck = validateApiKeyPermissions(
          requestedPermissions,
          callerPermissions
        )
        if (!callerCheck.valid)
          throw new Exception(
            403,
            `Cannot grant permissions you do not hold: ${callerCheck.invalidPermissions?.join(', ')}`,
            `FORBIDDEN`
          )
      }

      // Verify target user is a member of the scope
      if (projectId) {
        const { data: isMember, error: memberErr } =
          await db.services.role.isProjectMember(keyData.userId, projectId)
        if (memberErr)
          throw new Exception(
            500,
            `Failed to verify project membership: ${memberErr.message}`
          )
        if (!isMember)
          throw new Exception(400, `Target user is not a member of this project`)
      } else {
        const { data: isMember, error: memberErr } = await db.services.role.isOrgMember(
          keyData.userId,
          orgId
        )
        if (memberErr)
          throw new Exception(
            500,
            `Failed to verify org membership: ${memberErr.message}`
          )
        if (!isMember)
          throw new Exception(400, `Target user is not a member of this organization`)
      }

      await validatePermissionsSubset(
        req,
        requestedPermissions,
        scopeContext,
        keyData.userId
      )
      targetUserId = keyData.userId
    } else {
      // Self-creation: validate permissions against caller's own permissions
      await validatePermissionsSubset(req, requestedPermissions, scopeContext)
    }

    try {
      const { key, hash, prefix } = generateApiKey()
      const apiKeyData = new ApiKey({
        name,
        active: true,
        keyHash: hash,
        keyPrefix: prefix,
        userId: targetUserId,
        rateLimit: rateLimit || 100,
        permissions: requestedPermissions,
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
