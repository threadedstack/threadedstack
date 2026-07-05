import type { TVerifyProbe, TVerifyResult } from '@tdsk/domain'

import {
  DefaultVerifyProbe,
  EVerifyProbeKind,
  OpsAllowedDeployments,
  VerifyDeclareBlockFence,
  VerifyResultsBlockFence,
} from '@tdsk/domain'

import { lastFencedBlock, parseJsonArray, nonEmptyString } from './skill'

const ValidProbeKinds = new Set<string>(Object.values(EVerifyProbeKind))

/**
 * Read the LAST tdsk-verify block from a PR body and coerce it to a TVerifyProbe.
 * The block content is a single JSON object; malformed/missing → DefaultVerifyProbe.
 * Be lenient: also accepts an array whose first entry has the probe shape.
 */
export const probeFromPrBody = (body: string): TVerifyProbe => {
  const raw = lastFencedBlock(body, VerifyDeclareBlockFence)
  if (!raw) return DefaultVerifyProbe

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DefaultVerifyProbe
  }

  // Accept `{kind, params?}` OR an array whose first entry has that shape.
  const obj = Array.isArray(parsed) ? parsed[0] : parsed
  if (!obj || typeof obj !== `object`) return DefaultVerifyProbe

  const kind = (obj as any).kind
  if (typeof kind !== `string` || !ValidProbeKinds.has(kind)) return DefaultVerifyProbe

  const params = (obj as any).params
  return {
    kind: kind as TVerifyProbe[`kind`],
    ...(params && typeof params === `object` ? { params } : {}),
  }
}

/**
 * Read the LAST tdsk-verify-results block from runtime-brain stdout and return
 * validated TVerifyResult entries. Each entry requires:
 *   - prNumber: a positive integer (coerced via Number() — string digits accepted)
 *   - status: exactly 'verified' or 'regressed'
 * Optional fields (mergeSha, detail, revertPrUrl) are only included when non-empty.
 * Malformed block or missing block → [].
 */
export const parseVerifyResultsBlock = (text: string): TVerifyResult[] => {
  if (!text) return []

  const block = lastFencedBlock(text, VerifyResultsBlockFence)
  if (block === undefined) return []

  const parsed = parseJsonArray(block, VerifyResultsBlockFence)
  if (!parsed) return []

  const out: TVerifyResult[] = []
  for (const item of parsed) {
    if (!item || typeof item !== `object`) continue

    const prNumber = Number((item as any).prNumber)
    if (!Number.isInteger(prNumber) || prNumber <= 0) continue

    const status = (item as any).status
    if (status !== `verified` && status !== `regressed`) continue

    const entry: TVerifyResult = { prNumber, status }

    if (nonEmptyString((item as any).mergeSha)) entry.mergeSha = (item as any).mergeSha
    if (nonEmptyString((item as any).detail)) entry.detail = (item as any).detail
    if (nonEmptyString((item as any).revertPrUrl))
      entry.revertPrUrl = (item as any).revertPrUrl

    out.push(entry)
  }

  return out
}

// ─── verifyDeploy ─────────────────────────────────────────────────────────────

export type TVerifyEnv = `production` | `staging`

/** One probe result. */
export type TVerifyProbeResult = { probe: TVerifyProbe; passed: boolean; detail?: string }

/**
 * The env-to-host lookup. Kept in-file (not in domain) since it reflects
 * deploy-config reality. Update alongside deploy/values.*.yaml.
 *
 * production: TDSK_CADDY_PX_HOST = px.threadedstack.app
 * staging:    TDSK_CADDY_PX_HOST = px-staging.threadedstack.app
 */
const EnvHost: Record<TVerifyEnv, { proxy: string }> = {
  production: { proxy: `https://px.threadedstack.app` },
  staging: { proxy: `https://px-staging.threadedstack.app` },
}

/** Minimal shape of app that verifyDeploy needs. */
type TVerifyApp = { locals: { kube: { readDeployment: (name: string) => Promise<any> } } }

/**
 * Run a set of probes against a target env. Each probe is bounded (10s per
 * HTTP call). Returns the aggregate green + per-probe failures.
 *
 * Supported probe kinds in backend context:
 *  - health         — fetch <envHost.proxy>/health (or params.url); assert body.status==='ok'.
 *  - marker-advanced — deployedSha from kube.readDeployment('tdsk-backend') must match/prefix params.mergeSha.
 *  - ci-green       — NOT usable here; returns passed:false with an in-pod detail.
 *  - assertion      — NOT usable here; returns passed:false with an in-pod detail.
 */
export const verifyDeploy = async (
  app: TVerifyApp,
  opts: { env: TVerifyEnv; probes: TVerifyProbe[] }
): Promise<{
  green: boolean
  failures: TVerifyProbeResult[]
  results: TVerifyProbeResult[]
}> => {
  const hosts = EnvHost[opts.env]
  const results: TVerifyProbeResult[] = []

  for (const probe of opts.probes) {
    try {
      if (probe.kind === EVerifyProbeKind.health) {
        const url = (probe.params?.url as string | undefined) ?? `/_/health`
        const target = url.startsWith(`http`) ? url : `${hosts.proxy}${url}`
        const res = await fetchWithTimeout(target, 10_000)
        if (!res.ok) {
          results.push({ probe, passed: false, detail: `${target} → HTTP ${res.status}` })
          continue
        }
        const body = await res.json().catch(() => ({}) as Record<string, unknown>)
        if ((body as any).status !== `ok`) {
          results.push({
            probe,
            passed: false,
            detail: `${target} body.status=${JSON.stringify((body as any).status)} (expected 'ok')`,
          })
          continue
        }
        results.push({ probe, passed: true, detail: `${target} → status=ok` })
      } else if (probe.kind === EVerifyProbeKind.markerAdvanced) {
        const mergeSha = probe.params?.mergeSha as string | undefined
        if (!mergeSha) {
          results.push({
            probe,
            passed: false,
            detail: `marker-advanced requires params.mergeSha`,
          })
          continue
        }
        const dep = await app.locals.kube.readDeployment(`tdsk-backend`)
        const m = (dep.image ?? ``).match(/^.*:sha-([0-9a-f]{7,40})$/)
        const deployedSha = m ? m[1] : null
        if (!deployedSha) {
          results.push({
            probe,
            passed: false,
            detail: `unable to extract deployedSha from image ${dep.image}`,
          })
          continue
        }
        if (
          deployedSha === mergeSha ||
          mergeSha.startsWith(deployedSha) ||
          deployedSha.startsWith(mergeSha)
        ) {
          results.push({
            probe,
            passed: true,
            detail: `deployedSha=${deployedSha} matches mergeSha=${mergeSha}`,
          })
        } else {
          results.push({
            probe,
            passed: false,
            detail: `deployedSha=${deployedSha} !== mergeSha=${mergeSha} (marker has not advanced)`,
          })
        }
      } else if (
        probe.kind === EVerifyProbeKind.ciGreen ||
        probe.kind === EVerifyProbeKind.assertion
      ) {
        results.push({
          probe,
          passed: false,
          detail: `${probe.kind} must be evaluated in-pod by the runtime brain (C4 executor path handles it); verifyDeploy skips it.`,
        })
      } else {
        results.push({
          probe,
          passed: false,
          detail: `unknown probe kind ${(probe as any).kind}`,
        })
      }
    } catch (e) {
      results.push({
        probe,
        passed: false,
        detail: `probe threw: ${(e as Error).message}`,
      })
    }
  }

  const failures = results.filter((r) => !r.passed)
  return { green: failures.length === 0, failures, results }
}

/**
 * Check that every deployment in `names` (default: OpsAllowedDeployments) has
 * ready replicas equal to desired replicas.
 */
export const verifyDeploymentsReady = async (
  app: TVerifyApp,
  opts: { names?: readonly string[] }
): Promise<{
  ready: boolean
  detail: Array<{ name: string; ready: number; desired: number }>
  failures: string[]
}> => {
  const names = opts.names ?? OpsAllowedDeployments
  const detail: Array<{ name: string; ready: number; desired: number }> = []
  const failures: string[] = []
  for (const name of names) {
    try {
      const dep = await app.locals.kube.readDeployment(name)
      const ready = dep.replicas.ready ?? 0
      const desired = dep.replicas.desired ?? 0
      detail.push({ name, ready, desired })
      if (desired > 0 && ready !== desired) {
        failures.push(`${name}: ready=${ready}/${desired}`)
      }
    } catch (e) {
      failures.push(`${name}: readDeployment failed: ${(e as Error).message}`)
    }
  }
  return { ready: failures.length === 0, detail, failures }
}

// Small helper — uses global fetch (Node 20+).
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}
