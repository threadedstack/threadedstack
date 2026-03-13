import type { TLLMProviderBrand } from '@TDM/types/ai.types'
import type { TGitBrand } from '@TDM/types/git.types'

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
