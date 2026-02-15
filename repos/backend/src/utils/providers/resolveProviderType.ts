import { Exception } from '@TBE/utils/errors/exception'
import { ELLMProvider, ProviderTemplates } from '@tdsk/domain'

/**
 * Resolves the LLM provider type from a provider record.
 *
 * Resolution priority:
 * 1. Explicit `options.llmProvider` (most reliable — set by quickstart and admin UI)
 * 2. Exact match of `provider.name` against ELLMProvider enum values
 * 3. Match `provider.name` against ProviderTemplate display names (e.g. "Google AI" → "google")
 * 4. Throw — never silently defaults
 */
export const resolveProviderType = (provider: {
  name?: string | null
  options?: Record<string, any> | null
}): string => {
  // 1. Explicit llmProvider in options
  const llmProvider = provider.options?.llmProvider
  if (llmProvider && typeof llmProvider === `string`) {
    const valid = Object.values(ELLMProvider) as string[]
    if (valid.includes(llmProvider)) return llmProvider
  }

  // 2. Exact match against enum values
  const name = provider.name?.toLowerCase()
  if (name) {
    const valid = Object.values(ELLMProvider) as string[]
    if (valid.includes(name)) return name

    // 3. Match against template display names (e.g. "Google AI" → "google")
    for (const [key, template] of Object.entries(ProviderTemplates)) {
      if (key !== `custom` && template.name.toLowerCase() === name) return key
    }
  }

  // 4. No match — throw with actionable error
  const supported = Object.values(ELLMProvider).join(`, `)
  throw new Exception(
    400,
    `Cannot determine LLM provider for "${provider.name || `unnamed`}". ` +
      `Set provider.options.llmProvider to one of: ${supported}`
  )
}
