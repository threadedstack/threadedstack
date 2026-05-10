import type { TPlaceholderMap } from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { PhTokenPrefix } from '@TBE/constants/values'

type TGitProviderLink = {
  priority: number
  branch?: string | null
  provider: {
    id: string
    brand?: string | null
    secretId?: string | null
    options?: Record<string, any> | null
  }
}

type TGitEnvResult = {
  errors: string[]
  extraEnv: Record<string, string>
  placeholders: TPlaceholderMap
}

export const resolveGitProviderEnv = async (
  links: TGitProviderLink[]
): Promise<TGitEnvResult> => {
  const sorted = [...links].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
  const errors: string[] = []
  const extraEnv: Record<string, string> = {}
  const placeholders: TPlaceholderMap = {}

  let validCount = 0
  for (const link of sorted) {
    const { provider } = link
    const repoUrl = provider.options?.repoUrl as string | undefined

    if (!repoUrl) {
      errors.push(
        `Git provider '${provider.brand || provider.id}' has no repoUrl configured`
      )
      continue
    }

    const prefix = `TDSK_GIT_${validCount}`
    const branch = link.branch || (provider.options?.branch as string) || `main`

    extraEnv[`${prefix}_REPO`] = repoUrl
    extraEnv[`${prefix}_BRANCH`] = branch
    if (provider.brand) extraEnv[`${prefix}_BRAND`] = provider.brand

    if (provider.secretId) {
      const token = `${PhTokenPrefix}${nanoid(16)}`
      placeholders[token] = { secretId: provider.secretId }
      extraEnv[`${prefix}_TOKEN`] = token
    }

    validCount++
  }

  extraEnv.TDSK_GIT_COUNT = String(validCount)

  return { errors, extraEnv, placeholders }
}
