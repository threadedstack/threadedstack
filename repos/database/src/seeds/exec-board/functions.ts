import type { EFunLanguage } from '@tdsk/domain'

import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { OpenDecisionFunctionDef } from '@TDB/seeds/exec-board/functions/openDecision'
import { PostPositionFunctionDef } from '@TDB/seeds/exec-board/functions/postPosition'
import { ResolveBoardFunctionDef } from '@TDB/seeds/exec-board/functions/resolveBoard'
import { UpsertStrategyFunctionDef } from '@TDB/seeds/exec-board/functions/upsertStrategy'
import { ReportInitiativeCompleteFunctionDef } from '@TDB/seeds/exec-board/functions/reportInitiativeComplete'

/**
 * Board effect Function seeding — Exec-Board on Primitives (⑤a-3).
 *
 * The 5 board Functions (openDecision / postPosition / upsertStrategy /
 * reportInitiativeComplete / resolveBoard) live as git-versioned source strings
 * in `seeds/exec-board/functions/*` and reconcile into the exec project's
 * `functions` table here, the same declarative pattern as `reconcileSchedules`:
 * missing → create, drifted (name/description/content/language/projectId) →
 * update, else unchanged (no churn). Pure and DB-agnostic (injected service
 * slice), so it is unit-testable without a live connection; the deploy runner
 * in `scripts/reconcileExecBoard.ts` wires it to the real function service.
 *
 * Additive and inert: nothing invokes these until the board schedules carry
 * their `actions` allowlists (⑤a-4) and are enabled (⑤a-5).
 */

/** A board Function definition: stable id + the seedable function record fields. */
export type TExecBoardFunctionDef = {
  id: string
  name: string
  description: string
  language: EFunLanguage
  content: string
}

/** The five board effect Functions, in invocation-surface order. */
export const ExecBoardFunctionDefs: TExecBoardFunctionDef[] = [
  OpenDecisionFunctionDef,
  PostPositionFunctionDef,
  UpsertStrategyFunctionDef,
  ReportInitiativeCompleteFunctionDef,
  ResolveBoardFunctionDef,
]

/** The function-service slice the reconcile needs (Base get/create/update). */
export type TExecBoardFunctionService = {
  get: (id: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
  update: (item: any) => Promise<{ data?: any; error?: any }>
}

export type TExecBoardFunctionAction = `created` | `updated` | `unchanged` | `error`

export type TExecBoardFunctionsSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: {
    id: string
    name: string
    action: TExecBoardFunctionAction
    message?: string
  }[]
}

/** The declarative function-record fields the reconciler manages. */
export const functionRecordFields = (def: TExecBoardFunctionDef, projectId: string) => ({
  id: def.id,
  name: def.name,
  description: def.description,
  content: def.content,
  language: def.language,
  projectId,
})

/** True when any declarative field on the live row differs from the definition. */
export const functionNeedsUpdate = (
  existing: any,
  def: TExecBoardFunctionDef,
  projectId: string
): boolean =>
  existing.name !== def.name ||
  (existing.description ?? null) !== def.description ||
  existing.content !== def.content ||
  existing.language !== def.language ||
  existing.projectId !== projectId

/**
 * Idempotently seed the five board Function records into the exec project:
 * missing row → create, drifted declarative field → update (git is the source
 * of truth for the bodies), else unchanged. Never throws — every outcome is
 * captured in the summary.
 */
export const reconcileExecBoardFunctions = async (
  service: TExecBoardFunctionService,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TExecBoardFunctionsSummary> => {
  const summary: TExecBoardFunctionsSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (def: TExecBoardFunctionDef, message?: string) => {
    summary.errors++
    summary.results.push({ id: def.id, name: def.name, action: `error`, message })
    log(`  ❌ function ${def.name} (${def.id}) — ${message ?? `unknown error`}`)
  }

  for (const def of ExecBoardFunctionDefs) {
    try {
      const existing = await service.get(def.id)
      if (existing.error) {
        fail(def, `get failed: ${existing.error.message}`)
        continue
      }

      if (!existing.data) {
        const res = await service.create(functionRecordFields(def, projectId))
        if (res.error) fail(def, `create failed: ${res.error.message}`)
        else {
          summary.created++
          summary.results.push({ id: def.id, name: def.name, action: `created` })
          log(`  ✅ function ${def.name} (${def.id}) — created`)
        }
        continue
      }

      if (!functionNeedsUpdate(existing.data, def, projectId)) {
        summary.unchanged++
        summary.results.push({ id: def.id, name: def.name, action: `unchanged` })
        log(`  ➖ function ${def.name} (${def.id}) — unchanged`)
        continue
      }

      const res = await service.update(functionRecordFields(def, projectId))
      if (res.error) fail(def, `update failed: ${res.error.message}`)
      else {
        summary.updated++
        summary.results.push({ id: def.id, name: def.name, action: `updated` })
        log(`  🔄 function ${def.name} (${def.id}) — updated`)
      }
    } catch (err: any) {
      fail(def, err?.message)
    }
  }

  return summary
}
