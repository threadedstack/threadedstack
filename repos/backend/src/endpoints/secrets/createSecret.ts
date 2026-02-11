import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { validateExclusiveArc } from '@TBE/utils/validation/exclusiveArc'
import {
  Secret,
  deriveKey,
  EPermAction,
  encryptValue,
  createHashKey,
  EPermResource,
  encodeEncrypted,
} from '@tdsk/domain'

/**
 * POST /secrets - Create a new secret
 * Requires admin+ role in the org/project
 */
export const createSecret: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, value, agentId, providerId, description } = req.body

    const { orgId: paramOrgId, projectId: paramProjectId } = req.params
    const orgId = paramOrgId || req.body.orgId
    const projectId = paramProjectId || req.body.projectId

    if (!name) throw new Exception(400, `Secret name is required`)
    if (!value) throw new Exception(400, `Secret value is required`)

    const arcFields = [
      { name: `orgId`, value: orgId },
      { name: `agentId`, value: agentId },
      { name: `projectId`, value: projectId },
      { name: `providerId`, value: providerId },
    ]
    const owner = validateExclusiveArc(arcFields, `Secret`)

    // Check permission - requires admin+
    if (owner.name === `providerId`) {
      // Provider secrets: look up provider to get its orgId for auth context
      const { data: provider } = await db.services.provider.get(owner.value)
      if (!provider) throw new Exception(404, `Provider not found`)
      await checkPermission(req, EPermAction.create, EPermResource.secret, {
        orgId: provider.orgId,
      })
    } else if (owner.name === `agentId`) {
      // Agent secrets: look up agent to get its orgId for auth context
      const { data: agent } = await db.services.agent.get(owner.value)
      if (!agent) throw new Exception(404, `Agent not found`)
      await checkPermission(req, EPermAction.create, EPermResource.secret, {
        orgId: agent.orgId,
      })
    } else {
      await checkPermission(req, EPermAction.create, EPermResource.secret, {
        orgId,
        projectId,
      })
    }

    try {
      // Derive encryption key using the owner's ID
      const refId = owner.value
      const derivedKey = await deriveKey(refId)

      const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
      const encryptedValue = encodeEncrypted(iv, authTag, encrypted)
      const hashKey = createHashKey(name)

      const secret = new Secret({
        name,
        hashKey,
        description,
        encryptedValue,
        ...(orgId && { orgId }),
        ...(agentId && { agentId }),
        ...(projectId && { projectId }),
        ...(providerId && { providerId }),
      })

      const { data, error } = await db.services.secret.create(secret)
      if (error) throw new Exception(500, error.message)

      res.status(201).json({ data: data.sanitize() })
    } catch (err) {
      if (err instanceof Exception) throw err

      const message = err instanceof Error ? err.message : `Failed to encrypt secret`
      throw new Exception(500, message)
    }
  },
}
