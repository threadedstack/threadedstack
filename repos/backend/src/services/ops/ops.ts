import type { TDatabase } from '@tdsk/database'
import type { TApp } from '@TBE/types'

import { EOpsAction, OpsAllowedDeployments } from '@tdsk/domain'
import { scanOpsAction } from '@TBE/utils/agent/opsScan'

/** sha-<7-40 hex> tag pattern (mirrors changedContexts.deployedSha). */
const SHA_TAG_RE = /^sha-([0-9a-f]{7,40})$/

/** Extract the deployed SHA from a container image string, e.g. `ghcr.io/…:sha-abc1234` → `abc1234`. */
const extractDeployedSha = (image: string | undefined): string | undefined => {
  if (!image) return undefined
  const tag = image.split(`:`).pop() || ``
  const match = tag.match(SHA_TAG_RE)
  return match ? match[1] : undefined
}

type TOpsServiceCtx = { orgId: string; agentId: string }

export type TOpsService = {
  podStatus(
    params: { component?: string; podName?: string },
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; pods: any[]; error?: string }>
  podLogs(
    params: {
      component?: string
      podName?: string
      tailLines?: number
      previous?: boolean
    },
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; logs: string; error?: string }>
  deployState(
    params: { deployment?: string },
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; deployments: any[]; error?: string }>
  quotaUsage(
    params: Record<string, never>,
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; quotas: any[]; error?: string }>
}

/**
 * Create the ops READ tier service. Each method:
 * 1. Runs the deterministic scan (fail-closed).
 * 2. Calls the KubeClient primitive.
 * 3. Writes an ops_actions audit row (executed | rejected | failed).
 * 4. Returns structured data — NEVER rethrows to the caller.
 */
export const createOpsService = (app: TApp, db: TDatabase): TOpsService => {
  const kube = app.locals.kube
  if (!kube) throw new Error(`[OpsService] app.locals.kube is not available`)

  /** Write an audit row and suppress any db errors (audit failure must never block the caller). */
  const audit = async (
    action: string,
    params: any,
    status: string,
    ctx: TOpsServiceCtx,
    extra: Record<string, any> = {}
  ): Promise<void> => {
    try {
      await db.services.opsAction.create({
        action,
        params,
        status,
        dryRun: false,
        orgId: ctx.orgId,
        agentId: ctx.agentId,
        ...extra,
      } as any)
    } catch {
      // Audit failure is swallowed — never let it mask the real result.
    }
  }

  // ── podStatus ────────────────────────────────────────────────────────────────

  const podStatus = async (
    params: { component?: string; podName?: string },
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; pods: any[]; error?: string }> => {
    const { component, podName } = params
    const action = EOpsAction.podStatus

    // Validate required params before scan (avoids scan cost on obviously bad input)
    if (!component && !podName) {
      return { ok: false, pods: [], error: `component or podName required` }
    }

    // 1. Scan
    const scanResult = await scanOpsAction(
      { action, params: params as any },
      { db, orgId: ctx.orgId }
    )
    if (!scanResult.passed) {
      await audit(action, params, `rejected`, ctx, {
        scanResult,
        reason: scanResult.findings.join(`; `),
        result: { ok: false, error: `scan failed: ${scanResult.findings.join(`; `)}` },
      })
      return {
        ok: false,
        pods: [],
        error: `scan failed: ${scanResult.findings.join(`; `)}`,
      }
    }

    // 2. Kube call
    const startedAt = new Date().toISOString()
    try {
      const selector = podName
        ? `statefulset.kubernetes.io/pod-name=${podName}`
        : `app.kubernetes.io/component=${component}`

      const pods = await kube.listPodsBySelector(selector)
      const completedAt = new Date().toISOString()

      // 3. Audit success
      await audit(action, params, `executed`, ctx, {
        scanResult,
        result: { ok: true, data: { podCount: pods.length }, startedAt, completedAt },
      })

      return { ok: true, pods }
    } catch (err: any) {
      const error = (err as Error).message
      await audit(action, params, `failed`, ctx, {
        scanResult,
        result: { ok: false, error, startedAt },
      })
      return { ok: false, pods: [], error }
    }
  }

  // ── podLogs ─────────────────────────────────────────────────────────────────

  const podLogs = async (
    params: {
      component?: string
      podName?: string
      tailLines?: number
      previous?: boolean
    },
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; logs: string; error?: string }> => {
    const { component, tailLines = 100, previous = false } = params
    let { podName } = params
    const action = EOpsAction.podLogs

    // 1. Scan
    const scanResult = await scanOpsAction(
      { action, params: params as any },
      { db, orgId: ctx.orgId }
    )
    if (!scanResult.passed) {
      await audit(action, params, `rejected`, ctx, {
        scanResult,
        reason: scanResult.findings.join(`; `),
        result: { ok: false, error: `scan failed: ${scanResult.findings.join(`; `)}` },
      })
      return {
        ok: false,
        logs: ``,
        error: `scan failed: ${scanResult.findings.join(`; `)}`,
      }
    }

    // 2. Kube call
    const startedAt = new Date().toISOString()
    try {
      // Resolve podName from component when not supplied
      if (!podName && component) {
        const pods = await kube.listPodsBySelector(
          `app.kubernetes.io/component=${component}`
        )
        podName = pods[0]?.name
      }

      if (!podName) {
        const error = `No pod found for component '${component ?? `(none)`}'`
        await audit(action, params, `failed`, ctx, {
          scanResult,
          result: { ok: false, error, startedAt },
        })
        return { ok: false, logs: ``, error }
      }

      const logs = await kube.readPodLogs(podName, {
        tailLines,
        previous,
        container: component,
      })
      const completedAt = new Date().toISOString()

      await audit(action, params, `executed`, ctx, {
        scanResult,
        result: {
          ok: true,
          data: { podName, lineCount: logs.split(`\n`).length },
          startedAt,
          completedAt,
        },
      })

      return { ok: true, logs }
    } catch (err: any) {
      const error = (err as Error).message
      await audit(action, params, `failed`, ctx, {
        scanResult,
        result: { ok: false, error, startedAt },
      })
      return { ok: false, logs: ``, error }
    }
  }

  // ── deployState ──────────────────────────────────────────────────────────────

  const deployState = async (
    params: { deployment?: string },
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; deployments: any[]; error?: string }> => {
    const action = EOpsAction.deployState

    // 1. Scan
    const scanResult = await scanOpsAction(
      { action, params: params as any },
      { db, orgId: ctx.orgId }
    )
    if (!scanResult.passed) {
      await audit(action, params, `rejected`, ctx, {
        scanResult,
        reason: scanResult.findings.join(`; `),
        result: { ok: false, error: `scan failed: ${scanResult.findings.join(`; `)}` },
      })
      return {
        ok: false,
        deployments: [],
        error: `scan failed: ${scanResult.findings.join(`; `)}`,
      }
    }

    // 2. Kube call
    const startedAt = new Date().toISOString()
    try {
      const names: readonly string[] = params.deployment
        ? [params.deployment]
        : OpsAllowedDeployments

      const deployments = await Promise.all(
        names.map(async (name) => {
          const dep = await kube.readDeployment(name)
          return {
            ...dep,
            deployedSha: extractDeployedSha(dep.image),
          }
        })
      )

      const completedAt = new Date().toISOString()

      await audit(action, params, `executed`, ctx, {
        scanResult,
        result: {
          ok: true,
          data: { deploymentCount: deployments.length },
          startedAt,
          completedAt,
        },
      })

      return { ok: true, deployments }
    } catch (err: any) {
      const error = (err as Error).message
      await audit(action, params, `failed`, ctx, {
        scanResult,
        result: { ok: false, error, startedAt },
      })
      return { ok: false, deployments: [], error }
    }
  }

  // ── quotaUsage ───────────────────────────────────────────────────────────────

  const quotaUsage = async (
    params: Record<string, never>,
    ctx: TOpsServiceCtx
  ): Promise<{ ok: boolean; quotas: any[]; error?: string }> => {
    const action = EOpsAction.quotaUsage

    // 1. Scan
    const scanResult = await scanOpsAction({ action, params }, { db, orgId: ctx.orgId })
    if (!scanResult.passed) {
      await audit(action, params, `rejected`, ctx, {
        scanResult,
        reason: scanResult.findings.join(`; `),
        result: { ok: false, error: `scan failed: ${scanResult.findings.join(`; `)}` },
      })
      return {
        ok: false,
        quotas: [],
        error: `scan failed: ${scanResult.findings.join(`; `)}`,
      }
    }

    // 2. Kube call
    const startedAt = new Date().toISOString()
    try {
      const quotas = await kube.listResourceQuotas()
      const completedAt = new Date().toISOString()

      await audit(action, params, `executed`, ctx, {
        scanResult,
        result: { ok: true, data: { quotaCount: quotas.length }, startedAt, completedAt },
      })

      return { ok: true, quotas }
    } catch (err: any) {
      const error = (err as Error).message
      await audit(action, params, `failed`, ctx, {
        scanResult,
        result: { ok: false, error, startedAt },
      })
      return { ok: false, quotas: [], error }
    }
  }

  return { podStatus, podLogs, deployState, quotaUsage }
}
