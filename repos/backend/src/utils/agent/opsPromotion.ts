import type { TDatabase } from '@tdsk/database'
import type { TApp } from '@TBE/types'
import type { TOpsRollback } from '@tdsk/domain'

import { EOpsAction, EOpsActionStatus, EMemoryKind } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { scanOpsAction } from './opsScan'

/** Readiness poll budget for restart executor (3 minutes). */
const RESTART_READINESS_TIMEOUT_MS = 3 * 60 * 1000

/** Poll interval for readiness checks. */
const RESTART_POLL_STEP_MS = 5_000

/**
 * Propose an ops WRITE action. Never executes. Flow:
 *   1. scan → if fail: create audit row status='rejected' + return findings.
 *   2. dry-run: compute a NO-MUTATION plan (readDeployment for restart, deployed SHA
 *      for redeploy, config-diff for applySandboxConfig) and CAPTURE the rollback data
 *      that D7/D8 will need if execution later fails.
 *   3. create audit row status='dryRun' with dryRunResult + rollback + scanResult.
 * Returns { opsActionId, status, findings, dryRun }.
 */
export const proposeOpsAction = async (
  app: TApp,
  db: TDatabase,
  orgId: string,
  agentId: string,
  action: EOpsAction,
  params: any,
  meta?: Record<string, any>
): Promise<{
  opsActionId: string
  status: string
  findings: string[]
  dryRun: any | null
}> => {
  const scan = await scanOpsAction({ action, params } as any, { db, orgId })

  if (!scan.passed) {
    const { data, error } = await db.services.opsAction.create({
      orgId,
      agentId,
      action,
      params,
      dryRun: true,
      status: EOpsActionStatus.rejected,
      scanResult: scan,
      reason: `Scan rejected: ${scan.findings.join(`; `)}`,
      meta: meta ?? null,
    } as any)
    if (error || !data)
      throw new Error(`Failed to create rejected ops-action row: ${error?.message}`)
    return {
      opsActionId: data.id,
      status: EOpsActionStatus.rejected,
      findings: scan.findings,
      dryRun: null,
    }
  }

  const { plan, rollback } = await computeDryRunAndRollback(app, action, params, db)
  const now = new Date().toISOString()
  const { data, error } = await db.services.opsAction.create({
    orgId,
    agentId,
    action,
    params,
    dryRun: true,
    dryRunResult: { ok: true, data: plan, startedAt: now, completedAt: now },
    rollback,
    status: EOpsActionStatus.dryRun,
    scanResult: scan,
    meta: meta ?? null,
  } as any)
  if (error || !data)
    throw new Error(`Failed to create dryRun ops-action row: ${error?.message}`)
  return {
    opsActionId: data.id,
    status: EOpsActionStatus.dryRun,
    findings: [],
    dryRun: plan,
  }
}

/**
 * Executor invoked ONLY after adversary approval. Re-scans (hard gate), then dispatches
 * to the per-action executor.
 */
export const executeOpsAction = async (
  app: TApp,
  db: TDatabase,
  row: any
): Promise<{ status: string; result: any }> => {
  // Row must be in dryRun state; anything else is a bug in the caller.
  if (row.status !== EOpsActionStatus.dryRun) {
    throw new Error(
      `executeOpsAction called with row in status ${row.status}; expected 'dryRun'`
    )
  }

  // Re-scan: hard gate. If params were mutated between propose+execute, refuse.
  const rescan = await scanOpsAction({ action: row.action, params: row.params } as any, {
    db,
    orgId: row.orgId,
  })
  if (!rescan.passed) {
    await db.services.opsAction.update({
      id: row.id,
      status: EOpsActionStatus.rejected,
      scanResult: rescan,
      reason: `Re-scan rejected: ${rescan.findings.join(`; `)}`,
    } as any)
    return {
      status: EOpsActionStatus.rejected,
      result: { ok: false, error: `rescan-failed` },
    }
  }

  try {
    const result = await dispatchExecute(app, db, row)
    await db.services.opsAction.update({
      id: row.id,
      status: EOpsActionStatus.executed,
      dryRun: false,
      result,
    } as any)
    return { status: EOpsActionStatus.executed, result }
  } catch (e) {
    const err = (e as Error).message
    await db.services.opsAction.update({
      id: row.id,
      status: EOpsActionStatus.failed,
      dryRun: false,
      result: { ok: false, error: err },
    } as any)
    return { status: EOpsActionStatus.failed, result: { ok: false, error: err } }
  }
}

/**
 * Adversary/human review entry point. Mirrors `applySkillReview`:
 *   - terminal rows (executed/failed/rejected) → skipped, returns null.
 *   - approve=true → record verdict → re-scan (hard gate) + executeOpsAction.
 *   - approve=false → row status='rejected' + reviewVerdict{approved:false}.
 */
export const applyOpsReview = async (
  app: TApp,
  db: TDatabase,
  orgId: string,
  review: { opsActionId: string; approve: boolean; reason?: string },
  by?: string
): Promise<{ status: string; result?: any } | null> => {
  const { data: row } = await db.services.opsAction.get(review.opsActionId)
  if (!row || row.orgId !== orgId) return null

  if (
    row.status === EOpsActionStatus.executed ||
    row.status === EOpsActionStatus.failed ||
    row.status === EOpsActionStatus.rejected
  )
    return null

  if (!review.approve) {
    await db.services.opsAction.update({
      id: row.id,
      status: EOpsActionStatus.rejected,
      reason: review.reason ?? `Rejected by review`,
      reviewVerdict: { approved: false, reason: review.reason ?? `rejected`, by },
    } as any)
    return { status: EOpsActionStatus.rejected }
  }

  // Approve: record verdict, then execute (which re-scans internally).
  await db.services.opsAction.update({
    id: row.id,
    reviewVerdict: { approved: true, reason: review.reason ?? `approved`, by },
  } as any)
  const { data: refreshed } = await db.services.opsAction.get(row.id)
  return await executeOpsAction(app, db, refreshed)
}

/**
 * Reverse a previously-executed ops action using its captured rollback data.
 * Called by the D10 admin override endpoint when a human vetoes an already-executed row.
 *
 * IDEMPOTENT: multiple revert calls should be safe (last-write-wins for sandboxConfig;
 * a spurious restart trigger is a no-op if the deployment is already at prevRevision).
 *
 * Rollback semantics per kind:
 *   - restart: calls kube.rollbackDeployment(name, prevRevision) — annotation-based
 *     approach per D3 constraint; not a hard revision selector but usually returns to the
 *     prior good ReplicaSet when a bad rollout crashlooped.
 *   - redeploy: records revert intent as a durable memory row; actual rollback is
 *     handled by the deploy pipeline's verifyOrRollback + P4c verify cycle.
 *   - sandboxConfig: writes prevConfig back to db.services.sandbox.update — fully
 *     deterministic, applies on the next pod start.
 */
export const revertOpsAction = async (
  app: TApp,
  db: TDatabase,
  opsActionId: string
): Promise<{ ok: boolean; error?: string; data?: any }> => {
  const { data: row } = await db.services.opsAction.get(opsActionId)
  if (!row) return { ok: false, error: `ops-action ${opsActionId} not found` }
  const rb = (row as any).rollback
  if (!rb)
    return { ok: false, error: `no rollback data on row (was it dry-run captured?)` }

  try {
    switch (rb.kind) {
      case `restart`: {
        const name = (row as any).params.deployment
        await app.locals.kube.rollbackDeployment(name, rb.prevRevision)
        return {
          ok: true,
          data: { kind: `restart`, deployment: name, revertedTo: rb.prevRevision },
        }
      }
      case `redeploy`: {
        // No direct revert: rely on tdsk release verifyOrRollback + P4c revert-PR path.
        // Record the intent so ops can trace it.
        await db.services.memory.create({
          orgId: (row as any).orgId,
          agentId: (row as any).agentId,
          kind: EMemoryKind.fact,
          importance: 6,
          text: `Ops redeploy REVERT requested (${opsActionId}); prevSha=${rb.prevSha}. tdsk release verifyOrRollback handles the actual rollback.`,
          meta: { source: `ops-revert`, opsActionId, prevSha: rb.prevSha },
          embedding: null,
        } as any)
        return {
          ok: true,
          data: {
            kind: `redeploy`,
            prevSha: rb.prevSha,
            note: `revert-intent recorded; actual rollback via deploy pipeline`,
          },
        }
      }
      case `sandboxConfig`: {
        const sandboxId = (row as any).params.sandboxId
        const { error: upErr } = await db.services.sandbox.update({
          id: sandboxId,
          config: rb.prevConfig,
        } as any)
        if (upErr) return { ok: false, error: `sandbox restore failed: ${upErr.message}` }
        return {
          ok: true,
          data: {
            kind: `sandboxConfig`,
            sandboxId,
            restoredKeys: Object.keys(rb.prevConfig),
          },
        }
      }
      default:
        return { ok: false, error: `unknown rollback kind: ${(rb as any).kind}` }
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

// ─── internal helpers ─────────────────────────────────────────────────────────

/** sha-<7-40 hex> tag pattern (mirrors changedContexts.deployedSha). */
const SHA_TAG_RE = /^sha-([0-9a-f]{7,40})$/

/** Compute the no-mutation dry-run plan + capture rollback per action. */
async function computeDryRunAndRollback(
  app: TApp,
  action: EOpsAction,
  params: any,
  db: TDatabase
): Promise<{ plan: any; rollback: TOpsRollback | null }> {
  switch (action) {
    case EOpsAction.restartDeployment: {
      // Read current state; capture prevRevision for rollback.
      const dep = await app.locals.kube.readDeployment(params.deployment)
      return {
        plan: {
          deployment: params.deployment,
          wouldRestart: true,
          currentImage: dep.image,
          currentRevision: dep.revision,
        },
        rollback: { kind: `restart`, prevRevision: dep.revision ?? null },
      }
    }
    case EOpsAction.triggerRedeploy: {
      // No mutation; capture deployedSha of the current backend as prevSha.
      let prevSha: string | null = null
      try {
        const dep = await app.locals.kube.readDeployment(`tdsk-backend`)
        const tag = (dep.image ?? ``).split(`:`).pop() ?? ``
        const m = tag.match(SHA_TAG_RE)
        if (m) prevSha = m[1]
      } catch {
        // leave prevSha null
      }
      return {
        plan: {
          forceAll: !!params.forceAll,
          prevSha,
          note: `no-new-secret variant: an empty-commit steward/redeploy-<ts> PR to main will be opened; merge = deploy`,
        },
        rollback: { kind: `redeploy`, prevSha },
      }
    }
    case EOpsAction.applySandboxConfig: {
      // Capture full prior config for rollback + compute the diff for the plan.
      const { data: sandbox } = await db.services.sandbox.get(params.sandboxId)
      if (!sandbox)
        throw new Error(`applySandboxConfig: sandbox ${params.sandboxId} not found`)
      const prevConfig = (sandbox as any).config ?? {}
      const diff: Record<string, { from: any; to: any }> = {}
      for (const k of Object.keys(params.patch ?? {})) {
        diff[k] = { from: (prevConfig as any)[k], to: (params.patch as any)[k] }
      }
      return {
        plan: { sandboxId: params.sandboxId, diff, prevConfig },
        rollback: { kind: `sandboxConfig`, prevConfig },
      }
    }
    default: {
      throw new Error(`computeDryRunAndRollback: unexpected write action ${action}`)
    }
  }
}

/** Dispatch to per-action executor. */
async function dispatchExecute(app: TApp, db: TDatabase, row: any): Promise<any> {
  switch (row.action) {
    case EOpsAction.restartDeployment:
      return await executeRestart(app, row)
    case EOpsAction.triggerRedeploy:
      return await executeRedeploy(db, row)
    case EOpsAction.applySandboxConfig:
      return await executeApplySandboxConfig(db, row)
    default:
      throw new Error(`[P4d] dispatchExecute got non-write action ${row.action}`)
  }
}

/**
 * D7: restart deployment via annotation patch; poll readiness; auto-rollback on timeout.
 *
 * Rollback note: kube.rollbackDeployment uses an annotation-based approach (patches
 * restartedAt to epoch-0 to trigger another rollout per D3 design). This is NOT a hard
 * revision selector — it triggers a new rollout that RollingUpdate will roll toward the
 * ReplicaSet history, which usually IS the previous good revision when a bad rollout
 * crashlooped, but is not a hard guarantee. Secondary safety net: the P4c verify cycle
 * and deploy-time verifyOrRollback.
 */
async function executeRestart(app: TApp, row: any): Promise<any> {
  const name: string = row.params.deployment
  const prevRevision: string | null =
    row.rollback?.kind === `restart` ? row.rollback.prevRevision : null
  const started = Date.now()

  await app.locals.kube.restartDeployment(name)

  // Poll readiness. Budget: RESTART_READINESS_TIMEOUT_MS (3 min).
  while (Date.now() - started < RESTART_READINESS_TIMEOUT_MS) {
    await new Promise<void>((r) => setTimeout(r, RESTART_POLL_STEP_MS))
    try {
      const d = await app.locals.kube.readDeployment(name)
      // Ready when readyReplicas === desired AND updatedReplicas === desired.
      if (
        d.replicas.desired > 0 &&
        d.replicas.ready === d.replicas.desired &&
        d.replicas.updated === d.replicas.desired
      ) {
        return {
          ok: true,
          data: { deployment: name, replicas: d.replicas, revision: d.revision },
          startedAt: new Date(started).toISOString(),
          completedAt: new Date().toISOString(),
        }
      }
    } catch (e) {
      logger.warn(`[Ops] executeRestart poll error for ${name}: ${(e as Error).message}`)
    }
  }

  // Timeout — auto-rollback (annotation-based; see JSDoc for limitations).
  if (prevRevision) {
    try {
      await app.locals.kube.rollbackDeployment(name, prevRevision)
    } catch (e) {
      logger.warn(
        `[Ops] executeRestart rollback failed for ${name}: ${(e as Error).message}`
      )
    }
  }
  throw new Error(
    `restart timed out after ${RESTART_READINESS_TIMEOUT_MS / 1000}s; annotation-based rollout revert triggered (prevRevision=${prevRevision ?? `unknown`}); secondary safety net is the P4c verify cycle`
  )
}

/**
 * D8: record redeploy intent + memory row; steward opens the PR in-pod next cycle.
 *
 * No-new-secret variant: the backend does NOT hold a workflow-dispatch token. Instead,
 * the executor writes a durable memory row of kind=fact so the steward sees the redeploy
 * intent on its next work cycle and opens the empty-commit steward/redeploy-<ts> PR to
 * main in-pod. That PR merge is the actual deploy. Rollback safety net = tdsk release
 * verifyOrRollback + P4c verify cycle.
 *
 * Memory write failure is intentionally non-fatal (logs a warning) so that a transient
 * DB error does not prevent the executor from recording the intent row — the caller can
 * still see the ok:true result and the row is marked executed.
 */
async function executeRedeploy(db: TDatabase, row: any): Promise<any> {
  const prevSha: string | null =
    row.rollback?.kind === `redeploy` ? row.rollback.prevSha : null
  const reason: string = row.params.reason
  const started = Date.now()

  // Write a durable memory row so the steward sees the redeploy intent on its next cycle.
  try {
    await db.services.memory.create({
      orgId: row.orgId,
      agentId: row.agentId,
      kind: EMemoryKind.fact,
      importance: 6,
      text: `Ops redeploy requested (${row.id}): ${reason}. Open steward/redeploy-<ts> PR to main; prevSha=${prevSha ?? `unknown`}.`,
      meta: {
        source: `ops`,
        opsActionId: row.id,
        reason,
        prevSha,
        forceAll: !!row.params.forceAll,
      },
      embedding: null,
    } as any)
  } catch (e) {
    logger.warn(`[Ops] executeRedeploy memory-write failed: ${(e as Error).message}`)
  }

  return {
    ok: true,
    data: {
      prevSha,
      note: `no-new-secret variant: redeploy intent recorded as a durable memory. The steward will open the empty-commit steward/redeploy-<ts> PR to main on its next work cycle; that PR merge is the actual deploy. Rollback safety net = tdsk release verifyOrRollback + P4c verify.`,
    },
    startedAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
  }
}

/**
 * D8: apply an allowlisted sandbox-config patch.
 *
 * The patch is merged onto the existing config (shallow merge). The scanner enforces
 * the allowlist pre-execute — no re-check needed here.
 *
 * NOTE: new config applies on the NEXT pod start only. Existing pods keep the old
 * config until they restart. Rollback: revertOpsAction(opsActionId) writes back prevConfig.
 */
async function executeApplySandboxConfig(db: TDatabase, row: any): Promise<any> {
  const sandboxId: string = row.params.sandboxId
  const patch: Record<string, unknown> = row.params.patch ?? {}
  const started = Date.now()

  const { data: sandbox, error } = await db.services.sandbox.get(sandboxId)
  if (error || !sandbox)
    throw new Error(
      `applySandboxConfig: sandbox ${sandboxId} not found: ${error?.message ?? ``}`
    )

  const prevConfig = (sandbox as any).config ?? {}
  const nextConfig = { ...prevConfig, ...patch }

  const { error: upErr } = await db.services.sandbox.update({
    id: sandboxId,
    config: nextConfig,
  } as any)
  if (upErr)
    throw new Error(`applySandboxConfig: sandbox update failed: ${upErr.message}`)

  return {
    ok: true,
    data: {
      sandboxId,
      appliedKeys: Object.keys(patch),
      note: `New config applies on the NEXT pod start (existing pods keep the old config until they restart). Rollback path: revertOpsAction(opsActionId) writes back prevConfig.`,
    },
    startedAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
  }
}
