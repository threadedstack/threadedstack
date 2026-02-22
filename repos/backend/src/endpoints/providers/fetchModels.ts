import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'
import { ELLMProviderBrand, ProviderTemplates } from '@tdsk/domain'
import { DynamicModels } from '@TBE/services/providers/dynamicModels'

const validBrands = new Set(Object.values(ELLMProviderBrand))

/**
 * POST /providers/:brand/models
 * Body: { baseUrl?, providerKey? }
 * Returns { data: [{ id, name, maxTokens?, contextWindow?, description? }] }
 *
 * - Anthropic: Static models (no public models API)
 *
 * Falls back to static ProviderTemplates when no key is provided or the upstream call fails.
 */
export const fetchModels: TEndpointConfig = {
  path: `/:brand/models`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { brand } = req.params
    const { baseUrl, providerKey } = req.body || {}

    if (!validBrands.has(brand as ELLMProviderBrand))
      throw new Exception(400, `Invalid provider brand "${brand}"`)

    const dym = new DynamicModels()
    const staticFallback = () =>
      ProviderTemplates[brand as ELLMProviderBrand]?.models || []

    try {
      let models: any[]

      switch (brand) {
        case ELLMProviderBrand.openai:
          models = providerKey ? await dym.openAI(providerKey) : staticFallback()
          break
        case ELLMProviderBrand.google:
          models = providerKey ? await dym.google(providerKey) : staticFallback()
          break
        case ELLMProviderBrand.openrouter:
          models = await dym.openRouter()
          break
        case ELLMProviderBrand.ollama: {
          const ollamaUrl = baseUrl || ProviderTemplates[ELLMProviderBrand.ollama].baseUrl
          models = await dym.ollama(ollamaUrl)
          break
        }
        case ELLMProviderBrand.zai:
          models = providerKey ? await dym.zai(providerKey) : staticFallback()
          break
        default:
          models = staticFallback()
      }

      res.status(200).json({ data: models })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to fetch models`
      logger.error(`fetchModels error for ${brand}: ${message}`)

      // Fall back to static models instead of failing hard
      const fallback = staticFallback()
      if (fallback.length > 0) {
        res.status(200).json({ data: fallback })
        return
      }

      throw new Exception(502, `Failed to fetch models from ${brand}: ${message}`)
    }
  },
}
