import { EProvider, ELLMProviderBrand } from '@tdsk/domain'
import { Exception } from '@TBE/utils/errors/exception'

const validLLMProviders = Object.values(ELLMProviderBrand) as string[]

/**
 * Validates that AI-type providers have brand set to a valid ELLMProviderBrand value.
 * Non-AI providers (git, auth, storage) are not validated.
 */
export const validateLLMProvider = (type?: string, brand?: string | null) => {
  if (type !== EProvider.ai) return

  if (!brand || typeof brand !== `string` || !validLLMProviders.includes(brand))
    throw new Exception(
      400,
      `AI providers require brand to be one of: ${validLLMProviders.join(`, `)}` +
        (brand ? `. Got: "${brand}"` : ``)
    )
}
