import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  agents,
  secrets,
  projects,
  providers,
  endpoints,
  agentProjects,
  agentProviders,
} from '@tdsk/database/schemas'
import {
  EProvider,
  Exception,
  deriveKey,
  EPermAction,
  encryptValue,
  createHashKey,
  EPermResource,
  encodeEncrypted,
  ProviderTemplates,
} from '@tdsk/domain'
import { ModelRegistry } from '@TBE/services/providers/modelRegistry'

/**
 * POST /:orgId/quickstart - Create Provider + Secret + Project + Agent + Endpoint
 * in a single database transaction.
 *
 * Requires admin+ role in the organization.
 */
export const orgQuickstart: TEndpointConfig = {
  path: `/:orgId/quickstart`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const orgId = req.params.orgId

    if (!orgId) throw new Exception(400, `Organization ID is required`)

    const {
      model,
      apiKey,
      maxTokens,
      agentName,
      projectName,
      providerUrl,
      systemPrompt,
      providerName,
      providerBrand,
      agentDescription,
    } = req.body

    // --- Validate required fields ---
    if (!providerBrand) throw new Exception(400, `providerBrand is required`)

    if (!apiKey) throw new Exception(400, `apiKey is required`)

    if (!projectName) throw new Exception(400, `projectName is required`)

    if (!agentName) throw new Exception(400, `agentName is required`)

    // Resolve template
    const template = ProviderTemplates[providerBrand]
    if (!template) throw new Exception(400, `Unknown template: ${providerBrand}`)

    // Custom provider requires name + baseUrl + brand
    if (providerBrand === `custom`) {
      if (!providerName)
        throw new Exception(400, `providerName is required for custom providers`)
      if (!providerUrl)
        throw new Exception(400, `providerUrl is required for custom providers`)
    }

    const proName = providerBrand === `custom` ? providerName : template.name
    const baseUrl = providerBrand === `custom` ? providerUrl : template.baseUrl
    const secretName =
      providerBrand === `custom` ? `PROVIDER_API_KEY` : template.defaultSecretName

    // Resolve model defaults — pi-mono is the source of truth for models
    const resolvedModel = model || ModelRegistry.getDefaultModelId(providerBrand) || ``
    const modelEntry = ModelRegistry.getModel(providerBrand, resolvedModel)
    const resolvedMaxTokens = maxTokens || modelEntry?.maxTokens || 100000

    // --- Permission check ---
    await checkPermission(req, EPermAction.create, EPermResource.project, { orgId })

    // --- Create endpoint path slug ---
    const slug = agentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, `-`)
      .replace(/^-|-$/g, ``)
    const endpointPath = `/ai/${slug}`

    // --- Single transaction: create all 5 resources ---
    // TODO: move this to repos/database
    // Add some form of helpers that manage this
    try {
      const result = await db.transaction(async (tx) => {
        // 1. Provider (org-scoped)
        const [provider] = await tx
          .insert(providers)
          .values({
            orgId,
            name: proName,
            type: EProvider.ai,
            brand: providerBrand,
            options: {
              baseUrl,
            },
          })
          .returning()

        // 2. Encrypt API key using org ID (scope owner for org-scoped secrets)
        const derivedKey = await deriveKey(orgId)
        const encrypted = await encryptValue(derivedKey, apiKey)
        const encryptedValue = encodeEncrypted(
          encrypted.iv,
          encrypted.authTag,
          encrypted.encrypted
        )
        const hashKey = createHashKey(secretName)

        // 3. Secret (dual ownership: org-scoped for Secrets page visibility + provider-linked)
        const [secret] = await tx
          .insert(secrets)
          .values({
            name: secretName,
            hashKey,
            encryptedValue,
            orgId,
            providerId: provider.id,
          })
          .returning()

        // 4. Project (org-scoped)
        const [project] = await tx
          .insert(projects)
          .values({
            name: projectName,
            orgId,
            meta: {},
          })
          .returning()

        // 5. Agent (org-scoped)
        const [agent] = await tx
          .insert(agents)
          .values({
            name: agentName,
            orgId,
            model: resolvedModel,
            maxTokens: resolvedMaxTokens,
            ...(agentDescription && { description: agentDescription }),
            ...(systemPrompt && { systemPrompt }),
          })
          .returning()

        // 6. Agent-Provider junction (priority 0 = primary)
        await tx.insert(agentProviders).values({
          agentId: agent.id,
          providerId: provider.id,
          priority: 0,
        })

        // 7. Agent-Project junction
        await tx.insert(agentProjects).values({
          agentId: agent.id,
          projectId: project.id,
        })

        // 8. Endpoint (project-scoped, type=agent)
        const [endpoint] = await tx
          .insert(endpoints)
          .values({
            type: `agent`,
            method: `post`,
            name: agentName,
            path: endpointPath,
            projectId: project.id,
            options: { agentId: agent.id },
          })
          .returning()

        return {
          agent,
          secret,
          project,
          endpoint,
          provider,
        }
      })

      // Link the API key secret to the provider
      await db.services.provider.update({
        id: result.provider.id,
        secretId: result.secret.id,
      })

      // Sanitize secret - never return encryptedValue
      const { encryptedValue: _ev, ...sanitizedSecret } = result.secret

      res.status(201).json({
        data: {
          provider: result.provider,
          secret: sanitizedSecret,
          project: result.project,
          agent: result.agent,
          endpoint: result.endpoint,
        },
      })
    } catch (err) {
      if (err instanceof Exception) throw err

      // Extract the most useful error message from DB errors
      const dbErr = err as Record<string, unknown>
      const detail = dbErr.detail || dbErr.cause || ``
      const message = err instanceof Error ? err.message : `Quickstart failed`
      const fullMessage = detail ? `${message} — ${detail}` : message

      if (fullMessage.includes(`unique`) || fullMessage.includes(`duplicate`))
        throw new Exception(
          409,
          `A resource with that name already exists. ${fullMessage}`
        )

      throw new Exception(500, fullMessage)
    }
  },
}
