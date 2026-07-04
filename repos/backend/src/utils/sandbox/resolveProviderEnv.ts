import type { TRuntimeEnvVar, TPlaceholderMap } from '@tdsk/domain'
import type { SecretResolver } from '@TBE/services/secrets/secretResolver'

import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { isStr } from '@keg-hub/jsutils/isStr'
import { isArr } from '@keg-hub/jsutils/isArr'
import { PhTokenPrefix } from '@TBE/constants/values'
import {
  ESandboxRuntime,
  ERuntimeBrand,
  ProviderBrandDomains,
  RuntimeProviderEnvMap,
} from '@tdsk/domain'

type TProviderWithSecret = {
  id: string
  brand: string
  type?: string
  secretId?: string
  options?: Record<string, unknown>
}

type TSandboxProviderLink = {
  model?: string
  priority: number
  provider: TProviderWithSecret
}

type TResolveResult = {
  errors: string[]
  placeholders: TPlaceholderMap
  extraEnv: Record<string, string>
}

type TResolveOneResult = {
  brand: string
  errors: string[]
  env: Record<string, string>
  placeholders: TPlaceholderMap
}

type TResolveChainResult = {
  errors: string[]
  primaryBrand: string
  placeholders: TPlaceholderMap
  primaryEnv: Record<string, string>
  fallbacks: Array<{ brand: string; env: Record<string, string> }>
}

/**
 * Resolves the egress domain scope for a provider's MITM secret placeholder.
 * The egress proxy only enforces domain gating when allowedDomains is non-empty,
 * so every placeholder MUST carry a scope or the pod could swap the real secret
 * into a request to any host. Resolution chain (first non-empty wins):
 *   1. provider.options.allowedDomains (explicit, filtered to non-empty strings)
 *   2. ProviderBrandDomains[provider.brand] (known API domains per brand)
 *   3. hostname parsed from provider.options.baseUrl (custom/self-hosted APIs)
 * Returns undefined when no scope is resolvable — callers must fail closed.
 */
const resolveAllowedDomains = (provider: TProviderWithSecret): string[] | undefined => {
  const rawDomains = provider.options?.allowedDomains
  const explicit = isArr(rawDomains)
    ? rawDomains.filter((d): d is string => isStr(d) && d.length > 0)
    : undefined
  if (explicit?.length) return explicit

  const brandDomains =
    ProviderBrandDomains[provider.brand as keyof typeof ProviderBrandDomains]
  if (brandDomains?.length) return [...brandDomains]

  const baseUrl = provider.options?.baseUrl
  if (isStr(baseUrl) && baseUrl.length) {
    try {
      const { hostname } = new URL(baseUrl)
      if (hostname) return [hostname]
    } catch {
      return undefined
    }
  }

  return undefined
}

/**
 * Resolves a SINGLE linked provider into its own isolated env vars and MITM
 * placeholders. Looks up the (runtime, brand) mapping in RuntimeProviderEnvMap
 * and generates either:
 *   - MITM placeholder tokens (for API key secrets sent in HTTP headers)
 *   - Real decrypted values (for Sigv4 credentials, OAuth, etc.)
 *   - Static values (for flags like CLAUDE_CODE_USE_BEDROCK=1)
 *   - Provider option values (for baseUrl, region, model, etc.)
 *   - Base64-encoded file contents (for service account JSON -> file path)
 *
 * Returns a per-provider env set (NEVER merged with other providers) so callers
 * can keep each provider's `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL` distinct.
 * The generated placeholder is always domain-scoped (fail closed on no scope).
 *
 * @returns `{ brand, env, placeholders, errors }` — errors are collected but NOT
 *   thrown. Callers MUST check `errors.length > 0` before using `env`/`placeholders`.
 */
export async function resolveOneProviderEnv(
  runtime: string | undefined,
  link: TSandboxProviderLink,
  secretResolver: SecretResolver,
  orgId: string
): Promise<TResolveOneResult> {
  const env: Record<string, string> = {}
  const placeholders: TPlaceholderMap = {}
  const errors: string[] = []
  const { provider } = link

  if (!runtime) return { brand: provider.brand, env, placeholders, errors }

  const runtimeMap = RuntimeProviderEnvMap[runtime as keyof typeof RuntimeProviderEnvMap]
  if (!runtimeMap) return { brand: provider.brand, env, placeholders, errors }

  // Bedrock bearer token variant: check provider.options.authMethod
  let brandKey = provider.brand
  if (
    provider.brand === ERuntimeBrand.amazonBedrock &&
    provider.options?.authMethod === `bearer`
  )
    brandKey = ERuntimeBrand.amazonBedrockBearer

  // Anthropic subscription OAuth variant (claude setup-token): check provider.options.authMethod
  if (
    provider.brand === ERuntimeBrand.anthropic &&
    provider.options?.authMethod === `oauth`
  )
    brandKey = ERuntimeBrand.anthropicOAuth

  // Ollama cloud variant: provider with a secretId is cloud-hosted (needs real auth)
  if (provider.brand === ERuntimeBrand.ollama && provider.secretId)
    brandKey = ERuntimeBrand.ollamaCloud

  const mapping = runtimeMap[brandKey as keyof typeof runtimeMap] as
    | TRuntimeEnvVar[]
    | undefined
  if (!mapping) return { brand: provider.brand, env, placeholders, errors }

  for (const entry of mapping) {
    const injection = entry.injection ?? `mitm`

    if (entry.source === `static`) {
      if (entry.staticValue != null) env[entry.envVar] = entry.staticValue
      continue
    }

    if (entry.source === `option`) {
      const value = entry.optionKey
        ? (provider.options?.[entry.optionKey] as string | undefined)
        : undefined
      const resolved = value ?? entry.defaultValue
      if (resolved != null) env[entry.envVar] = String(resolved)
      else if (entry.required)
        errors.push(`Missing provider option '${entry.optionKey}' for ${entry.envVar}`)
      continue
    }

    // source === 'secret'
    if (!provider.secretId) {
      if (entry.required)
        errors.push(
          `Provider '${provider.brand}' has no secret configured for ${entry.envVar}`
        )
      continue
    }

    if (injection === `mitm`) {
      // Fail closed: an unscoped placeholder lets the pod exfiltrate the real
      // secret to any destination host via the egress proxy's secret swapping.
      const allowedDomains = resolveAllowedDomains(provider)
      if (!allowedDomains?.length) {
        errors.push(
          `Provider '${provider.brand}' has no resolvable domain scope for ${entry.envVar} — refusing unscoped secret placeholder`
        )
        continue
      }

      const token = `${PhTokenPrefix}${nanoid(16)}`
      placeholders[token] = {
        secretId: provider.secretId,
        allowedDomains,
      }
      env[entry.envVar] = token
    } else if (injection === `direct`) {
      try {
        const value = await secretResolver.resolveApiKey({ orgId }, provider)
        if (value) env[entry.envVar] = value
        else if (entry.required)
          errors.push(`Failed to decrypt secret for ${entry.envVar}`)
      } catch (err) {
        errors.push(
          `Secret resolution error for ${entry.envVar}: ${(err as Error).message}`
        )
      }
    } else if (injection === `file`) {
      try {
        const value = await secretResolver.resolveApiKey({ orgId }, provider)
        if (value && entry.filePath) {
          env[`TDSK_CRED_FILE_${entry.envVar}`] = Buffer.from(value).toString(`base64`)
          env[entry.envVar] = entry.filePath
        } else if (entry.required) {
          errors.push(`Failed to decrypt secret for credential file ${entry.envVar}`)
        }
      } catch (err) {
        errors.push(
          `Secret resolution error for credential file ${entry.envVar}: ${(err as Error).message}`
        )
      }
    }
  }

  // Inject junction-level model override. Currently only claude-code has a known
  // env var (ANTHROPIC_MODEL) for model selection via the RuntimeProviderEnvMap.
  if (link.model && runtime === ESandboxRuntime.claudeCode)
    env[`ANTHROPIC_MODEL`] = link.model

  return { brand: provider.brand, env, placeholders, errors }
}

/**
 * Resolves linked providers into a single MERGED env map and MITM placeholders
 * for pod injection. Each provider is resolved in isolation via
 * `resolveOneProviderEnv`, then merged in list order (last writer wins for
 * colliding env vars — the historical behavior for the connect/exec paths).
 *
 * @returns `{ extraEnv, placeholders, errors }` — errors are collected but NOT
 *   thrown. Callers MUST check `errors.length > 0` before using `extraEnv`/`placeholders`.
 */
export async function resolveProviderEnv(
  runtime: string | undefined,
  sandboxProviders: TSandboxProviderLink[],
  secretResolver: SecretResolver,
  orgId: string
): Promise<TResolveResult> {
  const extraEnv: Record<string, string> = {}
  const placeholders: TPlaceholderMap = {}
  const errors: string[] = []

  if (!runtime || !sandboxProviders.length) return { extraEnv, placeholders, errors }

  const runtimeMap = RuntimeProviderEnvMap[runtime as keyof typeof RuntimeProviderEnvMap]
  if (!runtimeMap) {
    logger.warn(`[resolveProviderEnv] No provider env mapping for runtime "${runtime}"`)
    return { extraEnv, placeholders, errors }
  }

  for (const link of sandboxProviders) {
    const one = await resolveOneProviderEnv(runtime, link, secretResolver, orgId)
    Object.assign(extraEnv, one.env)
    Object.assign(placeholders, one.placeholders)
    errors.push(...one.errors)
  }

  return { extraEnv, placeholders, errors }
}

/**
 * Resolves the linked ai providers into a PRIORITY-ORDERED failover chain for
 * the runtime brain (claude -p). Unlike resolveProviderEnv, each provider keeps
 * its OWN env set (never merged) so colliding vars like `ANTHROPIC_AUTH_TOKEN`
 * / `ANTHROPIC_BASE_URL` stay distinct per provider — a fallback attempt can be
 * launched by prefixing exactly one provider's env inline.
 *
 * - Links are sorted by priority ascending; priority-0 is the primary.
 * - `placeholders` is MERGED across ALL providers. Every token is a unique
 *   nanoid and stays domain-scoped (fail closed), so injecting all of them is
 *   safe: the egress proxy only swaps the real secret for a token when the
 *   outbound request host matches THAT token's allowedDomains. A fallback
 *   attempt can therefore only ever reach its own provider's domains.
 *
 * @returns `{ primaryEnv, primaryBrand, fallbacks, placeholders, errors }` —
 *   errors are collected but NOT thrown. Callers MUST check `errors.length > 0`.
 */
export async function resolveProviderEnvChain(
  runtime: string | undefined,
  aiProviderLinks: TSandboxProviderLink[],
  secretResolver: SecretResolver,
  orgId: string
): Promise<TResolveChainResult> {
  const placeholders: TPlaceholderMap = {}
  const errors: string[] = []
  const fallbacks: Array<{ brand: string; env: Record<string, string> }> = []

  let primaryEnv: Record<string, string> = {}
  let primaryBrand = ``

  const sorted = [...aiProviderLinks].sort((a, b) => a.priority - b.priority)

  for (let i = 0; i < sorted.length; i++) {
    const one = await resolveOneProviderEnv(runtime, sorted[i], secretResolver, orgId)
    Object.assign(placeholders, one.placeholders)
    errors.push(...one.errors)

    if (i === 0) {
      primaryEnv = one.env
      primaryBrand = one.brand
    } else {
      fallbacks.push({ brand: one.brand, env: one.env })
    }
  }

  return { primaryEnv, primaryBrand, fallbacks, placeholders, errors }
}
