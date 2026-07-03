import type { TPlaceholderMap } from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { isStr } from '@keg-hub/jsutils/isStr'
import { isArr } from '@keg-hub/jsutils/isArr'
import { PhTokenPrefix } from '@TBE/constants/values'

const GithubHost = `github.com`
const GithubApiHost = `api.github.com`
const GithubBrand = `github`

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

/**
 * Parses the hostname a git token authenticates against from the repo URL.
 * Returns undefined when the URL can't be parsed — callers must fail closed,
 * since an unscoped placeholder would let the pod swap the real token into a
 * request to any destination host via the egress proxy.
 */
const parseRepoHost = (repoUrl: string): string | undefined => {
  try {
    const { hostname } = new URL(repoUrl)
    return hostname || undefined
  } catch {
    return undefined
  }
}

/**
 * Resolves the domain scope for a git-token placeholder.
 * Precedence (mirrors resolveProviderEnv's resolveAllowedDomains):
 *   1. provider.options.allowedDomains (explicit, filtered to non-empty strings)
 *   2. The repo URL host, plus api.github.com when the host is github.com so
 *      `gh` CLI calls pass the egress fail-closed domain gate. Any other host
 *      stays repo-host-only.
 *
 * An explicit override may NARROW the default scope (e.g. deliberately omit
 * api.github.com) but may never REDIRECT it: the override must include the
 * repo host, otherwise the egress proxy would swap the real token into
 * requests to an attacker-controlled domain like ['attacker.com'].
 * Returns undefined for a redirecting override so callers fail closed.
 */
const resolveGitAllowedDomains = (
  options: Record<string, any> | null | undefined,
  repoHost: string
): string[] | undefined => {
  const rawDomains = options?.allowedDomains
  const explicit = isArr(rawDomains)
    ? rawDomains.filter((d): d is string => isStr(d) && d.length > 0)
    : undefined
  if (explicit?.length) return explicit.includes(repoHost) ? explicit : undefined

  return repoHost === GithubHost ? [repoHost, GithubApiHost] : [repoHost]
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

    // Fail closed: a token placeholder without a domain scope lets the pod
    // exfiltrate the real git token to any host, so the repo hostname must be
    // resolvable before any placeholder is created.
    const repoHost = provider.secretId ? parseRepoHost(repoUrl) : undefined
    if (provider.secretId && !repoHost) {
      errors.push(
        `Git provider '${provider.brand || provider.id}' has an unparseable repoUrl '${repoUrl}' — refusing unscoped secret placeholder`
      )
      continue
    }

    // Fail closed: an explicit allowedDomains override may narrow the token's
    // domain scope but must never redirect it away from the repo host, so a
    // redirecting override skips the provider entirely (no env, no placeholder)
    let allowedDomains: string[] | undefined
    if (provider.secretId && repoHost) {
      allowedDomains = resolveGitAllowedDomains(provider.options, repoHost)
      if (!allowedDomains) {
        errors.push(
          `Git provider '${provider.brand || provider.id}' has an allowedDomains override that does not include the repo host '${repoHost}' — refusing redirected secret placeholder`
        )
        continue
      }
    }

    const prefix = `TDSK_GIT_${validCount}`
    const branch = link.branch || (provider.options?.branch as string) || `main`

    extraEnv[`${prefix}_REPO`] = repoUrl
    extraEnv[`${prefix}_BRANCH`] = branch
    if (provider.brand) extraEnv[`${prefix}_BRAND`] = provider.brand

    if (provider.secretId && repoHost && allowedDomains) {
      const token = `${PhTokenPrefix}${nanoid(16)}`
      placeholders[token] = {
        secretId: provider.secretId,
        allowedDomains,
      }
      extraEnv[`${prefix}_TOKEN`] = token

      // The gh CLI reads GH_TOKEN and sends it as an Authorization header,
      // which the egress proxy swaps for the real secret. Export it exactly
      // once, for the highest-priority github-brand provider that has a token
      // (links are already sorted by ascending priority above).
      if (provider.brand === GithubBrand && !extraEnv.GH_TOKEN) extraEnv.GH_TOKEN = token
    }

    validCount++
  }

  extraEnv.TDSK_GIT_COUNT = String(validCount)

  return { errors, extraEnv, placeholders }
}
