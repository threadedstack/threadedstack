import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  agents,
  secrets,
  projects,
  providers,
  endpoints,
  agentProjects,
} from '@tdsk/database/schemas'
import {
  deriveKey,
  EPermAction,
  encryptValue,
  createHashKey,
  EPermResource,
  encodeEncrypted,
  ProviderTemplates,
} from '@tdsk/domain'

/**
 * POST /:orgId/quickstart - Create Provider + Secret + Project + Agent + Endpoint
 * in a single database transaction.
 *
 * Requires admin+ role in the organization.
 */
export const quickstart: TEndpointConfig = {
  path: `/`,
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
      providerTemp,
      providerName,
      agentDescription,
    } = req.body

    // --- Validate required fields ---
    if (!providerTemp) throw new Exception(400, `template is required`)

    if (!apiKey) throw new Exception(400, `apiKey is required`)

    if (!projectName) throw new Exception(400, `projectName is required`)

    if (!agentName) throw new Exception(400, `agentName is required`)

    // Resolve template
    const proTemp = ProviderTemplates[providerTemp]
    if (!proTemp) throw new Exception(400, `Unknown template: ${providerTemp}`)

    // Custom provider requires name + baseUrl
    if (providerTemp === `custom`) {
      if (!providerName)
        throw new Exception(400, `providerName is required for custom providers`)
      if (!providerUrl)
        throw new Exception(400, `providerUrl is required for custom providers`)
    }

    const proName = providerTemp === `custom` ? providerName : proTemp.name
    const baseUrl = providerTemp === `custom` ? providerUrl : proTemp.baseUrl
    const secretName =
      providerTemp === `custom` ? `PROVIDER_API_KEY` : proTemp.defaultSecretName

    // Resolve model defaults
    const resolvedModel = model || proTemp.defaultModel
    const defaultModelEntry = proTemp.models.find((m) => m.id === resolvedModel)
    const resolvedMaxTokens = maxTokens || defaultModelEntry?.maxTokens || 100000

    // --- Permission check ---
    await checkPermission(req, EPermAction.create, EPermResource.project, { orgId })

    // --- Create endpoint path slug ---
    const slug = agentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, `-`)
      .replace(/^-|-$/g, ``)
    const endpointPath = `/ai/${slug}`

    // --- Single transaction: create all 5 resources ---
    try {
      const result = await db.transaction(async (tx) => {
        // 1. Provider (org-scoped)
        const [provider] = await tx
          .insert(providers)
          .values({
            name: proName,
            type: `ai`,
            orgId,
            options: { baseUrl },
          })
          .returning()

        // 2. Encrypt API key using provider ID (scope owner for provider-scoped secrets)
        const derivedKey = await deriveKey(provider.id)
        const encrypted = await encryptValue(derivedKey, apiKey)
        const encryptedValue = encodeEncrypted(
          encrypted.iv,
          encrypted.authTag,
          encrypted.encrypted
        )
        const hashKey = createHashKey(secretName)

        // 3. Secret (provider-scoped, encrypted API key)
        const [secret] = await tx
          .insert(secrets)
          .values({
            name: secretName,
            hashKey,
            encryptedValue,
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

        // 5. Agent (org-scoped, linked to provider)
        const [agent] = await tx
          .insert(agents)
          .values({
            name: agentName,
            orgId,
            providerId: provider.id,
            model: resolvedModel,
            maxTokens: resolvedMaxTokens,
            ...(agentDescription && { description: agentDescription }),
            ...(systemPrompt && { systemPrompt }),
          })
          .returning()

        // 6. Agent-Project junction
        await tx.insert(agentProjects).values({
          agentId: agent.id,
          projectId: project.id,
        })

        // 7. Endpoint (project-scoped, type=agent)
        const [endpoint] = await tx
          .insert(endpoints)
          .values({
            name: agentName,
            path: endpointPath,
            type: `agent`,
            method: `post`,
            projectId: project.id,
            options: { agentId: agent.id },
          })
          .returning()

        return { provider, secret, project, agent, endpoint }
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
