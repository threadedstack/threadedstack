import type { TRuntimeEnvVar, TPlaceholderMap } from '@tdsk/domain'
import type { SecretResolver } from '@TBE/services/secrets/secretResolver'

import { nanoid } from 'nanoid'
import { logger } from '@TBE/utils/logger'
import { isStr } from '@keg-hub/jsutils/isStr'
import { isArr } from '@keg-hub/jsutils/isArr'
import { PhTokenPrefix } from '@TBE/constants/values'
import { ESandboxRuntime, ERuntimeBrand, RuntimeProviderEnvMap } from '@tdsk/domain'

type TProviderWithSecret = {
  id: string
  brand: string
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

/**
 * Resolves linked providers into env vars and MITM placeholders for pod injection.
 *
 * For each linked provider, looks up the (runtime, brand) mapping in RuntimeProviderEnvMap
 * and generates either:
 *   - MITM placeholder tokens (for API key secrets sent in HTTP headers)
 *   - Real decrypted values (for Sigv4 credentials, OAuth, etc.)
 *   - Static values (for flags like CLAUDE_CODE_USE_BEDROCK=1)
 *   - Provider option values (for baseUrl, region, model, etc.)
 *   - Base64-encoded file contents (for service account JSON -> file path)
 *
 * @returns `{ extraEnv, placeholders, errors }` — errors are collected but NOT thrown.
 *   Callers MUST check `errors.length > 0` before using `extraEnv`/`placeholders`.
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
    const { provider } = link

    // Bedrock bearer token variant: check provider.options.authMethod
    let brandKey = provider.brand
    if (
      provider.brand === ERuntimeBrand.amazonBedrock &&
      provider.options?.authMethod === `bearer`
    )
      brandKey = ERuntimeBrand.amazonBedrockBearer

    // Ollama cloud variant: provider with a secretId is cloud-hosted (needs real auth)
    if (provider.brand === ERuntimeBrand.ollama && provider.secretId)
      brandKey = ERuntimeBrand.ollamaCloud

    const mapping = runtimeMap[brandKey as keyof typeof runtimeMap] as
      | TRuntimeEnvVar[]
      | undefined
    if (!mapping) continue

    for (const entry of mapping) {
      const injection = entry.injection ?? `mitm`

      if (entry.source === `static`) {
        if (entry.staticValue != null) extraEnv[entry.envVar] = entry.staticValue
        continue
      }

      if (entry.source === `option`) {
        const value = entry.optionKey
          ? (provider.options?.[entry.optionKey] as string | undefined)
          : undefined
        const resolved = value ?? entry.defaultValue
        if (resolved != null) extraEnv[entry.envVar] = String(resolved)
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
        const token = `${PhTokenPrefix}${nanoid(16)}`
        const rawDomains = provider.options?.allowedDomains
        const allowedDomains = isArr(rawDomains)
          ? rawDomains.filter((d): d is string => isStr(d) && d.length > 0)
          : undefined

        placeholders[token] = {
          secretId: provider.secretId,
          allowedDomains: allowedDomains?.length ? allowedDomains : undefined,
        }
        extraEnv[entry.envVar] = token
      } else if (injection === `direct`) {
        try {
          const value = await secretResolver.resolveApiKey({ orgId }, provider)
          if (value) extraEnv[entry.envVar] = value
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
            extraEnv[`TDSK_CRED_FILE_${entry.envVar}`] =
              Buffer.from(value).toString(`base64`)
            extraEnv[entry.envVar] = entry.filePath
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
      extraEnv[`ANTHROPIC_MODEL`] = link.model
  }

  return { extraEnv, placeholders, errors }
}
