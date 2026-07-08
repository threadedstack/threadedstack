import type { EFunLanguage } from '@tdsk/domain'

import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { ProposeTaskFunctionDef } from '@TDB/seeds/dev-loop/functions/proposeTask'
import { PickupTaskFunctionDef } from '@TDB/seeds/dev-loop/functions/pickupTask'
import { OpenEscalationFunctionDef } from '@TDB/seeds/dev-loop/functions/openEscalation'
import { ResolveEscalationFunctionDef } from '@TDB/seeds/dev-loop/functions/resolveEscalation'
import { RecordVerificationFunctionDef } from '@TDB/seeds/dev-loop/functions/recordVerification'

/**
 * Dev-loop effect Function seeding — Dev-Loop on Primitives (⑤b-2).
 *
 * The 5 workflow Functions (proposeTask / pickupTask / openEscalation /
 * resolveEscalation / recordVerification) live as git-versioned source strings
 * in `seeds/dev-loop/functions/*` and reconcile into the ops project's
 * `functions` table here, the same declarative pattern as
 * `reconcileExecBoardFunctions`: missing → create, drifted (name/description/
 * content/language/projectId) → update, else unchanged (no churn). Pure and
 * DB-agnostic (injected service slice), so it is unit-testable without a live
 * connection; the deploy runner in `scripts/reconcileDevLoop.ts` wires it to
 * the real function service.
 *
 * Additive and inert: nothing invokes these until the dev-loop schedules carry
 * their `actions` allowlists at the Phase 4 cutovers.
 */

/** A dev-loop Function definition: stable id + the seedable function record fields. */
export type TDevLoopFunctionDef = {
  id: string
  name: string
  description: string
  language: EFunLanguage
  content: string
}

/** The five dev-loop effect Functions, in workflow-cutover order. */
export const DevLoopFunctionDefs: TDevLoopFunctionDef[] = [
  ProposeTaskFunctionDef,
  PickupTaskFunctionDef,
  OpenEscalationFunctionDef,
  ResolveEscalationFunctionDef,
  RecordVerificationFunctionDef,
]

/** The function-service slice the reconcile needs (Base get/create/update). */
export type TDevLoopFunctionService = {
  get: (id: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
  update: (item: any) => Promise<{ data?: any; error?: any }>
}

export type TDevLoopFunctionAction = `created` | `updated` | `unchanged` | `error`

export type TDevLoopFunctionsSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: {
    id: string
    name: string
    action: TDevLoopFunctionAction
    message?: string
  }[]
}

/** The declarative function-record fields the reconciler manages. */
export const devLoopFunctionRecordFields = (
  def: TDevLoopFunctionDef,
  projectId: string
) => ({
  id: def.id,
  name: def.name,
  description: def.description,
  content: def.content,
  language: def.language,
  projectId,
})

/** True when any declarative field on the live row differs from the definition. */
export const devLoopFunctionNeedsUpdate = (
  existing: any,
  def: TDevLoopFunctionDef,
  projectId: string
): boolean =>
  existing.name !== def.name ||
  (existing.description ?? null) !== def.description ||
  existing.content !== def.content ||
  existing.language !== def.language ||
  existing.projectId !== projectId

/**
 * Idempotently seed the five dev-loop Function records into the ops project:
 * missing row → create, drifted declarative field → update (git is the source
 * of truth for the bodies), else unchanged. Never throws — every outcome is
 * captured in the summary.
 */
export const reconcileDevLoopFunctions = async (
  service: TDevLoopFunctionService,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TDevLoopFunctionsSummary> => {
  const summary: TDevLoopFunctionsSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (def: TDevLoopFunctionDef, message?: string) => {
    summary.errors++
    summary.results.push({ id: def.id, name: def.name, action: `error`, message })
    log(`  ❌ function ${def.name} (${def.id}) — ${message ?? `unknown error`}`)
  }

  for (const def of DevLoopFunctionDefs) {
    try {
      const existing = await service.get(def.id)
      if (existing.error) {
        fail(def, `get failed: ${existing.error.message}`)
        continue
      }

      if (!existing.data) {
        const res = await service.create(devLoopFunctionRecordFields(def, projectId))
        if (res.error) fail(def, `create failed: ${res.error.message}`)
        else {
          summary.created++
          summary.results.push({ id: def.id, name: def.name, action: `created` })
          log(`  ✅ function ${def.name} (${def.id}) — created`)
        }
        continue
      }

      if (!devLoopFunctionNeedsUpdate(existing.data, def, projectId)) {
        summary.unchanged++
        summary.results.push({ id: def.id, name: def.name, action: `unchanged` })
        log(`  ➖ function ${def.name} (${def.id}) — unchanged`)
        continue
      }

      const res = await service.update(devLoopFunctionRecordFields(def, projectId))
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
