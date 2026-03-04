import type { Agent } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

import { logger } from '@TBE/utils/logger'
import type { SecretResolver } from '@TBE/services/secrets/secretResolver'

type TResolvedAgentDeps = {
  customFunctions: any[]
  environment: Agent[`environment`]
}

/**
 * Resolve web provider API key and custom functions for an agent.
 * Shared by SSE (agentEndpoint) and WS (onWSConnect) paths.
 */
export const resolveAgentDeps = async (
  agent: Agent,
  db: TDatabase,
  secrets: SecretResolver,
  projectId?: string
): Promise<TResolvedAgentDeps> => {
  let environment = agent.environment ? { ...agent.environment } : undefined

  // Resolve web provider API key from encrypted secret
  const webProviderSecretId = environment?.webProvider?.secretId
  if (webProviderSecretId) {
    try {
      const { data: wpSecret } = await db.services.secret.get(webProviderSecretId)
      if (wpSecret?.encryptedValue) {
        const decrypted = await secrets.decrypt(wpSecret, agent.orgId)
        if (decrypted) {
          environment = {
            ...environment,
            webProvider: { ...environment?.webProvider, apiKey: decrypted },
          }
        } else {
          logger.warn(`Failed to decrypt webProvider secret`, {
            secretId: webProviderSecretId,
          })
        }
      } else {
        logger.warn(`WebProvider secret not found or has no encrypted value`, {
          secretId: webProviderSecretId,
        })
      }
    } catch (err) {
      // webProvider is optional — log but don't block agent execution
      logger.warn(`Failed to resolve webProvider API key`, {
        secretId: webProviderSecretId,
        error: err instanceof Error ? err.message : err,
      })
    }
  }

  // Load custom functions from project config (functions are project-scoped)
  let customFunctions: any[] = []
  if (projectId) {
    const projectConfig = agent.getProjectConfig(projectId)
    const functionIds = projectConfig?.functionIds || []
    // TODO: FIX THIS - This is a separate query for each function
    // Instead we should load all functions at once based on the functionIds array
    if (functionIds.length) {
      const results = await Promise.all(
        functionIds.map((fid: string) => db.services.function.get(fid))
      )
      customFunctions = results.filter((r) => r.data).map((r) => r.data)
    }
  }

  return { environment, customFunctions }
}
