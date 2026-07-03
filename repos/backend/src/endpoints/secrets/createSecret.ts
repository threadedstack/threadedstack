import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { validateExclusiveArc } from '@TBE/utils/validation/exclusiveArc'
import {
  Secret,
  Exception,
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
  middleware: [authorize(EPermAction.create, EPermResource.secret)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { name, value, agentId, providerId, description } = req.body

    const { orgId: paramOrgId, projectId: paramProjectId } = req.params
    // When agentId is set, exclude route orgId from arc so only the scoped owner is used
    // When providerId is set, keep route orgId for dual ownership (org + provider)
    const orgId = agentId ? req.body.orgId : paramOrgId || req.body.orgId
    const projectId = paramProjectId || req.body.projectId

    if (!name) throw new Exception(400, `Secret name is required`)
    if (!value) throw new Exception(400, `Secret value is required`)

    // Determine scope ownership and encryption key ref
    let refId: string
    // Provider row loaded when the secret is provider-linked (dual ownership
    // or exclusive-arc provider owner), used to backfill provider.secretId
    let linkedProvider: { orgId: string; secretId?: string | null } | undefined

    if (providerId && orgId) {
      // Dual ownership: secret belongs to both org and provider
      // This allows the secret to appear in both the Secrets page (via orgId)
      // and the Provider drawer (via providerId)
      if (projectId)
        throw new Exception(400, `Provider secrets cannot also be project-scoped`)
      if (agentId)
        throw new Exception(400, `Provider secrets cannot also be agent-scoped`)

      const { data: provider, error: providerErr } =
        await db.services.provider.get(providerId)
      if (providerErr) throw new Exception(500, providerErr.message)
      if (!provider) throw new Exception(404, `Provider not found`)
      if (provider.orgId !== orgId)
        throw new Exception(403, `Provider does not belong to this organization`)

      await checkPermission(req, EPermAction.create, EPermResource.secret, { orgId })
      linkedProvider = provider
      refId = orgId
    } else {
      // Standard exclusive arc: exactly one owner field
      // When projectId is set (project-scoped URL), exclude orgId from arc to avoid dual ownership
      const arcFields = [
        { name: `orgId`, value: projectId ? undefined : orgId },
        { name: `agentId`, value: agentId },
        { name: `projectId`, value: projectId },
        { name: `providerId`, value: providerId },
      ]
      const owner = validateExclusiveArc(arcFields, `Secret`)

      if (owner.name === `providerId`) {
        const { data: provider, error: providerErr } = await db.services.provider.get(
          owner.value
        )
        if (providerErr) throw new Exception(500, providerErr.message)
        if (!provider) throw new Exception(404, `Provider not found`)
        await checkPermission(req, EPermAction.create, EPermResource.secret, {
          orgId: provider.orgId,
        })
        linkedProvider = provider
      } else if (owner.name === `agentId`) {
        const { data: agent, error: agentErr } = await db.services.agent.get(owner.value)
        if (agentErr) throw new Exception(500, agentErr.message)
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

      refId = owner.value
    }

    // The backfill below mutates provider.secretId, so require an explicit
    // provider:update permission instead of relying on role algebra
    // (secret:create happening to imply provider:update). Checked BEFORE the
    // secret row is created so a denial never leaves an unlinked secret behind
    if (providerId && linkedProvider && !linkedProvider.secretId)
      await checkPermission(req, EPermAction.update, EPermResource.provider, {
        orgId: linkedProvider.orgId,
      })

    try {
      // Derive encryption key using the scope ref ID (orgId for dual ownership)
      const derivedKey = await deriveKey(refId)

      const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
      const encryptedValue = encodeEncrypted(iv, authTag, encrypted)
      const hashKey = createHashKey(name)

      const secret = new Secret({
        name,
        hashKey,
        description,
        encryptedValue,
        ...(agentId && { agentId }),
        ...(projectId && { projectId }),
        ...(providerId && { providerId }),
        ...(orgId && !projectId && !agentId && { orgId }),
      })

      const { data, error } = await db.services.secret.create(secret)
      if (error) throw new Exception(500, error.message)

      // Backfill the provider's API-key link so a freshly created provider
      // secret is immediately resolvable (SecretResolver.resolveApiKey reads
      // provider.secretId directly). An existing different secretId is
      // preserved, never clobbered: key rotation is an explicit provider
      // update, which the admin Provider drawer already performs after
      // creating a replacement secret.
      if (providerId && linkedProvider && !linkedProvider.secretId) {
        const { error: linkErr } = await db.services.provider.update({
          id: providerId,
          secretId: data.id,
        })
        if (linkErr)
          throw new Exception(
            500,
            `Secret created but failed to link it to provider: ${linkErr.message}`
          )
      }

      res.status(201).json({ data: data.sanitize() })
    } catch (err) {
      if (err instanceof Exception) throw err

      const message = err instanceof Error ? err.message : `Failed to encrypt secret`
      throw new Exception(500, message)
    }
  },
}
