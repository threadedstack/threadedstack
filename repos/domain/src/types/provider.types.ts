import type { TLLMProviderBrand } from '@TDM/types/ai.types'
import type { TGitBrand } from '@TDM/types/git.types'
import type { Provider } from '@TDM/models/provider'

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
