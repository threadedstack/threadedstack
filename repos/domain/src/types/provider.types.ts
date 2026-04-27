import type { Provider } from '@TDM/models/provider'
import type { TGitBrand } from '@TDM/types/git.types'
import type { TLLMProviderBrand, TModelCost } from '@TDM/types/ai.types'

export enum EProvider {
  ai = `ai`,
  git = `git`,
  auth = `auth`,
  storage = `storage`,
}
export type TProviderType = `${EProvider}`

export enum EAuthProviderBrand {
  neon = `neon`,
}
export type TAuthProviderBrand = `${EAuthProviderBrand}`

export enum EStorageProviderBrand {
  s3 = `s3`,
}
export type TStorageProviderBrand = `${EStorageProviderBrand}`

export type TProviderBrand =
  | TLLMProviderBrand
  | TGitBrand
  | TAuthProviderBrand
  | TStorageProviderBrand

/**
 * A provider linked to an agent or sandbox with junction metadata.
 * Priority 0 = primary provider, 1+ = fallback providers.
 */
export type TProviderLink = {
  priority: number
  provider: Provider
  model?: string | null
}

/**
 * Input shape for linking providers via create/update endpoints.
 * Priority is derived from array order (index 0 = primary).
 */
export type TProviderInput = {
  id: string
  model?: string | null
}

/**
 * Provider model entry — enriched with pi-mono metadata.
 * Only `id` and `name` are required; the rest come from pi-mono's registry.
 */
export type TProviderModel = {
  id: string
  name: string
  cost?: TModelCost
  maxTokens?: number
  reasoning?: boolean
  description?: string
  contextWindow?: number
  inputTypes?: string[]
}

/**
 * Provider template definition for the onboarding wizard.
 * Models are sourced from pi-mono's registry (via backend endpoint),
 * NOT from hardcoded arrays.
 */
export type TProviderTemplate = {
  name: string
  baseUrl: string
  id: TLLMProviderBrand
  apiKeyPattern?: string
  defaultSecretName: string
  apiKeyPlaceholder: string
}
