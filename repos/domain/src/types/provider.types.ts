import type { ELLMProvider } from '@TDM/types/ai.types'
import type { EGitProvider } from '@TDM/types/git.types'

export enum EProvider {
  ai = `ai`,
  git = `git`,
  auth = `auth`,
  storage = `storage`,
}
export type TProviderType = `${EProvider}`

// TODO: add other provider keys here when they are built out
// i.e. 
export type TProviderBrand = ELLMProvider | EGitProvider