import type { Agent, Function } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'

import { logger } from '@TBE/utils/logger'
import type { SecretResolver } from '@TBE/services/secrets/secretResolver'

type TResolvedAgentDeps = {
  customFunctions: Function[]
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
  let customFunctions: Function[] = []
  if (projectId) {
    const projectConfig = agent.getProjectConfig(projectId)
    const functionIds = projectConfig?.functionIds || []
    if (functionIds.length) {
      const { data, error } = await db.services.function.getByIds(functionIds)
      if (error) {
        logger.warn(`Failed to load custom functions`, {
          functionIds,
          error: error instanceof Error ? error.message : error,
        })
      } else if (data) {
        customFunctions = data
        if (data.length < functionIds.length) {
          const loadedIds = new Set(data.map((f) => f.id))
          const missingIds = functionIds.filter((id) => !loadedIds.has(id))
          logger.warn(`Some custom functions not found`, { missingIds })
        }
      }
    }
  }

  return { environment, customFunctions }
}
