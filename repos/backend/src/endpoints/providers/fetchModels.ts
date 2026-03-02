import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import { ELLMProviderBrand, ProviderTemplates } from '@tdsk/domain'
import { ModelRegistry } from '@TBE/services/providers/modelRegistry'

const validBrands = new Set(Object.values(ELLMProviderBrand))

/**
 * POST /providers/:brand/models
 * Body: { baseUrl? }
 * Returns { data: TProviderModel[] }
 *
 * Models are sourced from pi-mono's static registry via ModelRegistry.
 * Ollama is special-cased: user-installed models are fetched live from
 * the local Ollama API and merged with any pi-mono entries.
 * Custom providers return an empty list (user provides model ID manually).
 */
export const fetchModels: TEndpointConfig = {
  path: `/:brand/models`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { brand } = req.params
    const { baseUrl } = req.body || {}

    if (!validBrands.has(brand as ELLMProviderBrand))
      throw new Exception(400, `Invalid provider brand "${brand}"`)

    try {
      // Custom providers have no model list — user provides model ID manually
      if (brand === ELLMProviderBrand.custom) {
        res.status(200).json({ data: [] })
        return
      }

      // Ollama: fetch live from local API (user-installed models)
      if (brand === ELLMProviderBrand.ollama) {
        const ollamaUrl = baseUrl || ProviderTemplates[ELLMProviderBrand.ollama].baseUrl
        const models = await ModelRegistry.fetchOllamaModels(ollamaUrl)

        res.status(200).json({ data: models })
        return
      }

      // All other providers: pi-mono static registry
      const models = ModelRegistry.getModels(brand)
      res.status(200).json({ data: models })
    } catch (err) {
      // Re-throw Exceptions (already have correct status code)
      if (err instanceof Exception) throw err

      const message = err instanceof Error ? err.message : `Failed to fetch models`
      logger.error(`fetchModels error for ${brand}: ${message}`)

      // For Ollama failures, throw 502 (server not reachable)
      if (brand === ELLMProviderBrand.ollama)
        throw new Exception(502, `Failed to fetch models from ${brand}`)

      // For other brands, pi-mono registry is static and shouldn't fail,
      // but if it does, return empty rather than crashing
      res.status(200).json({ data: [] })
    }
  },
}
