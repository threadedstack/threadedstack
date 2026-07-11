import type { TProviderModel } from '@tdsk/domain'
import type { Model, Api, KnownProvider } from '@earendil-works/pi-ai'

import { logger } from '@TBE/utils/logger'
import { DefProviderModelUrls } from '@tdsk/domain'
import { getModels, getModel } from '@earendil-works/pi-ai'

/**
 * ModelRegistry — wraps pi-mono's model registry as the sole source
 * of truth for available LLM models.
 *
 * Ollama is a special case: models are user-installed locally, so
 * pi-mono's static registry won't know them. For Ollama we fetch
 * from the live API and merge with any pi-mono models.
 */
export class ModelRegistry {
  /**
   * Get all models for a provider from pi-mono's static registry.
   * Returns enriched TProviderModel[] with cost, contextWindow, reasoning, etc.
   */
  static getModels(provider: string): TProviderModel[] {
    try {
      const models = getModels(provider as KnownProvider)
      return models.map(ModelRegistry.#mapModel)
    } catch (err) {
      logger.error(`[ModelRegistry] getModels failed for "${provider}":`, err)
      return []
    }
  }

  /**
   * Get a specific model by provider + modelId.
   */
  static getModel(provider: string, modelId: string): TProviderModel | undefined {
    try {
      // modelId cast to `never`: TModelId is keyed off pi-ai's un-exported MODELS map,
      // so a runtime string can't satisfy it without erasure at this boundary.
      const model = getModel(provider as KnownProvider, modelId as never)
      return model ? ModelRegistry.#mapModel(model) : undefined
    } catch (err) {
      logger.error(`[ModelRegistry] getModel failed for "${provider}/${modelId}":`, err)
      return undefined
    }
  }

  /**
   * Get the default model for a provider (first in the registry list).
   */
  static getDefaultModelId(provider: string): string | undefined {
    const models = ModelRegistry.getModels(provider)
    return models[0]?.id
  }

  /**
   * Fetch models from a live Ollama instance (user-installed, not in pi-mono).
   * Throws on network/API errors so callers can distinguish failure from empty.
   */
  static async fetchOllamaModels(baseUrl?: string): Promise<TProviderModel[]> {
    const ollamaUrl = baseUrl
      ? `${baseUrl.replace(/\/v1\/?$/, ``)}/api/tags`
      : DefProviderModelUrls.ollamaUrl

    const resp = await fetch(ollamaUrl)
    if (!resp.ok) throw new Error(`Ollama API returned ${resp.status}`)

    const json = await resp.json()
    return (json.models || []).map((m: any) => ({
      id: m.name,
      name: m.name,
    }))
  }

  /**
   * Map a pi-mono Model to our TProviderModel shape.
   */
  static #mapModel(m: Model<Api>): TProviderModel {
    return {
      id: m.id,
      name: m.name || m.id,
      maxTokens: m.maxTokens || undefined,
      contextWindow: m.contextWindow || undefined,
      reasoning: m.reasoning || undefined,
      cost: m.cost || undefined,
      inputTypes: m.input || undefined,
    }
  }
}
