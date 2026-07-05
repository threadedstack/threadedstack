import type { TDatabase } from '@tdsk/database'
import type { TApp } from '@TBE/types'
import type { TOpsRollback } from '@tdsk/domain'

import { EOpsAction, EOpsActionStatus } from '@tdsk/domain'
import { scanOpsAction } from './opsScan'

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
 * to the per-action executor. STUBBED for the three write actions until D7/D8; the
 * dispatch switch throws a clear error so the adversary approval path fails
 * loudly rather than silently no-op-ing when write logic is not yet wired.
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
    const result = await dispatchExecute(app, row)
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

/** Dispatch to per-action executor. STUBBED for D7/D8. */
async function dispatchExecute(app: TApp, row: any): Promise<any> {
  switch (row.action) {
    case EOpsAction.restartDeployment:
      throw new Error(`[P4d D7 stub] restartDeployment executor not yet wired`)
    case EOpsAction.triggerRedeploy:
    case EOpsAction.applySandboxConfig:
      throw new Error(`[P4d D8 stub] ${row.action} executor not yet wired`)
    default:
      throw new Error(`[P4d] dispatchExecute got non-write action ${row.action}`)
  }
}
