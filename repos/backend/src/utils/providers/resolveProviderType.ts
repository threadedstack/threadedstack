import type { TProviderBrand } from '@tdsk/domain'

import { ELLMProviderBrand } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'

const validProviders = Object.values(ELLMProviderBrand) as string[]

/**
 * Resolves the LLM provider type from a provider record.
 *
 * Reads `provider.brand` which must be a valid ELLMProviderBrand value.
 * This is enforced at provider creation/update time by validateLLMProvider.
 */
export const resolveProviderType = <T = TProviderBrand>(provider: {
  name?: string | null
  brand?: T
}): T => {
  if (typeof provider.brand === `string` && validProviders.includes(provider.brand))
    return provider.brand

  const supported = validProviders.join(`, `)
  throw new Exception(
    400,
    `Cannot determine LLM provider for "${provider.name || `unnamed`}". ` +
      `Set provider.brand to one of: ${supported}`
  )
}
