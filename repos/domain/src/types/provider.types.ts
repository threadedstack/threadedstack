import type { Provider } from '@TDM/models/provider'
import type { TGitBrand } from '@TDM/types/git.types'
import type { TAIProviderBrand, TModelCost } from '@TDM/types/ai.types'

export enum EProvider {
  ai = `ai`,
  git = `git`,
  auth = `auth`,
  docker = `docker`,
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

export enum EDockerProviderBrand {
  quay = `quay`,
  ghcr = `ghcr`,
  gitlab = `gitlab`,
  custom = `custom`,
  dockerhub = `dockerhub`,
}
export type TDockerProviderBrand = `${EDockerProviderBrand}`

export type TProviderBrand =
  | TGitBrand
  | TAIProviderBrand
  | TAuthProviderBrand
  | TDockerProviderBrand
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
 * A git provider linked to a sandbox for a specific project context.
 * Stored in sandbox_project_providers junction table.
 */
export type TGitProviderLink = {
  priority: number
  provider: Provider
  projectId: string
  branch?: string | null
}

/**
 * Input shape for linking git providers to a sandbox in a project context.
 */
export type TGitProviderInput = {
  id: string
  branch?: string | null
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
  inputTypes?: string[]
  contextWindow?: number
}

/**
 * Provider template definition for the onboarding wizard.
 * Models are sourced from pi-mono's registry (via backend endpoint),
 * NOT from hardcoded arrays.
 */
export type TAIProviderTemplate = {
  name: string
  baseUrl: string
  id: TAIProviderBrand
  apiKeyPattern?: string
  defaultSecretName: string
  apiKeyPlaceholder: string
}

export type TDockerProviderTemplate = {
  name: string
  registry: string
  id: TDockerProviderBrand
  defaultSecretName: string
}

export type TGitProviderTemplate = {
  name: string
  id: TGitBrand
  gitDomain?: string
  apiUrlBase?: string
  tokenPattern?: string
  tokenPlaceholder: string
  defaultSecretName: string
}
