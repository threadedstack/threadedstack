import type { TValueOf } from '@TDM/types/helpers.types'
import type { TLLMProviderBrand } from '@TDM/types/ai.types'
import type { TGitBrand } from '@TDM/types/git.types'

export enum EProvider {
  ai = `ai`,
  git = `git`,
  auth = `auth`,
  storage = `storage`,
}
export type TProviderType = `${EProvider}`

// TODO: add other provider keys here when they are built out
// i.e.
export type TProviderBrand = TLLMProviderBrand | TGitBrand
