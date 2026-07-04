import type { TDatabase } from '@tdsk/database'
import type { TPlaceholderMap, TKubeSandboxConfig } from '@tdsk/domain'

import { EProvider } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import { resolveProviderEnvChain } from '@TBE/utils/sandbox/resolveProviderEnv'

export type TSandboxChain = {
  primaryBrand: string
  placeholders: TPlaceholderMap
  primaryEnv: Record<string, string>
  fallbacks: Array<{ brand: string; env: Record<string, string> }>
}

export type TResolvedSandboxChain = {
  sandboxConfig: TKubeSandboxConfig
  chain: TSandboxChain
}

/**
 * Resolve a sandbox's effective config ONCE and derive the priority-ordered
 * ai-provider failover chain for pod injection. Mirrors startPod's own
 * derivation (getEffectiveConfig + EProvider.ai links sorted by priority) so
 * the primary provider deterministically matches the pod default while each
 * fallback keeps its own isolated env for inline override.
 *
 * This is the ONLY correct env source for pods that run one-shot CLI children
 * (runtime-brain schedules, delegateTask): the legacy merged resolution
 * (`resolveProviderEnv`, used by startPod when no chain is passed) is
 * last-writer-wins across links, so a low-priority fallback provider can
 * hijack colliding vars like ANTHROPIC_AUTH_TOKEN/ANTHROPIC_BASE_URL for the
 * whole pod.
 *
 * A resolution error (e.g. an unscoped secret placeholder) throws — identical
 * to startPod refusing to launch a pod with a misconfigured provider. Also
 * enforces (defense in depth) that the sandbox belongs to the given org
 * before its provider secrets are turned into egress placeholders.
 */
export async function resolveSandboxProviderChain(
  db: TDatabase,
  opts: {
    orgId: string
    sandboxId: string
    projectId?: string
    /** Prefix for the project-config warning log (defaults to the fn name) */
    logContext?: string
  }
): Promise<TResolvedSandboxChain> {
  const { orgId, sandboxId, projectId } = opts
  const logContext = opts.logContext ?? `[resolveSandboxProviderChain]`

  const { data: rawSandbox } = await db.services.sandbox.get(sandboxId)
  if (!rawSandbox) throw new Error(`Sandbox config not found: ${sandboxId}`)

  if (rawSandbox.orgId && rawSandbox.orgId !== orgId)
    throw new Error(`Sandbox ${sandboxId} does not belong to org ${orgId}`)

  const effective = rawSandbox.getEffectiveConfig
    ? rawSandbox.getEffectiveConfig(projectId as string)
    : rawSandbox

  if (effective === rawSandbox && projectId)
    logger.warn(
      `${logContext} no project-specific config for project ${projectId}; using base sandbox config`
    )

  const sandboxConfig = effective.config as TKubeSandboxConfig

  const aiProviderLinks = (effective.providerLinks || [])
    .filter((link: any) => link.provider?.type === EProvider.ai)
    .map((link: any) => ({
      provider: link.provider,
      priority: link.priority ?? 0,
      model: link.model ?? undefined,
    }))

  const secrets = new SecretResolver(db)
  const chain = await resolveProviderEnvChain(
    sandboxConfig?.runtime,
    aiProviderLinks,
    secrets,
    orgId
  )

  if (chain.errors.length)
    throw new Error(`Provider auth configuration error: ${chain.errors.join(`, `)}`)

  return {
    sandboxConfig,
    chain: {
      primaryEnv: chain.primaryEnv,
      primaryBrand: chain.primaryBrand,
      placeholders: chain.placeholders,
      fallbacks: chain.fallbacks,
    },
  }
}
