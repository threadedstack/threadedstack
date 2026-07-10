import type { EFunLanguage } from '@tdsk/domain'

import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { DevClaimTaskFunctionDef } from '@TDB/seeds/dev-team/functions/devClaimTask'
import { DevSubmitPrFunctionDef } from '@TDB/seeds/dev-team/functions/devSubmitPr'
import { DevClaimReviewFunctionDef } from '@TDB/seeds/dev-team/functions/devClaimReview'
import { DevCompleteReviewFunctionDef } from '@TDB/seeds/dev-team/functions/devCompleteReview'
import { DevMarkMergedFunctionDef } from '@TDB/seeds/dev-team/functions/devMarkMerged'
import { DevUpdatePrFunctionDef } from '@TDB/seeds/dev-team/functions/devUpdatePr'
import { DevRenewLeaseFunctionDef } from '@TDB/seeds/dev-team/functions/devRenewLease'
import { DevAddTaskFunctionDef } from '@TDB/seeds/dev-team/functions/devAddTask'
import { DevReapExpiredFunctionDef } from '@TDB/seeds/dev-team/functions/devReapExpired'
import { DevAbandonFunctionDef } from '@TDB/seeds/dev-team/functions/devAbandon'

/**
 * Dev-team effect Function seeding — realtime engineering team (Phase 2).
 *
 * The 10 team Functions (devClaimTask / devSubmitPr / devClaimReview /
 * devCompleteReview / devMarkMerged / devUpdatePr / devRenewLease / devAddTask
 * / devReapExpired / devAbandon) are the `dev_tasks` state machine's ONLY
 * write path: every transition is won via the atomic `records.cas` primitive
 * and every identity gate (assignee-only submits, reviewer !== assignee,
 * verdict binds to headSha) is enforced IN the Function — platform-mediated,
 * never prompt discipline. Bodies live as git-versioned source strings in
 * `seeds/dev-team/functions/*` and reconcile into the ops project's
 * `functions` table here, the same declarative pattern as
 * `reconcileDevLoopFunctions`: missing → create, drifted (name/description/
 * content/language/projectId) → update, else unchanged (no churn). Pure and
 * DB-agnostic (injected service slice), so it is unit-testable without a live
 * connection; the deploy runner in `scripts/reconcileDevTeam.ts` wires it to
 * the real function service.
 *
 * HONESTY BOUNDARY — what the platform does and does NOT enforce: the
 * Functions enforce the RECORDED gates (atomic claims, reviewer !== assignee,
 * headSha-bound verdicts, leases). The GitHub-side steps — `gh pr merge
 * --admin` and the CI-green check before it — are PROMPT DISCIPLINE on a
 * shared GitHub account: both engineers act as one GitHub identity, so GitHub
 * itself cannot arbitrate reviewer independence or block an undisciplined
 * merge. The platform-enforced gate is the recorded dev_tasks verdict; never
 * claim GitHub-side enforcement.
 *
 * Additive and inert: nothing invokes these until an agent's resident config
 * carries them on its `actions` allowlist AND its sandbox is flipped to
 * resident mode (the shadow team's seeds ship without the flip).
 */

/** A dev-team Function definition: stable id + the seedable function record fields. */
export type TDevTeamFunctionDef = {
  id: string
  name: string
  description: string
  language: EFunLanguage
  content: string
}

/** The ten dev-team effect Functions, in state-machine order. */
export const DevTeamFunctionDefs: TDevTeamFunctionDef[] = [
  DevAddTaskFunctionDef,
  DevClaimTaskFunctionDef,
  DevSubmitPrFunctionDef,
  DevClaimReviewFunctionDef,
  DevCompleteReviewFunctionDef,
  DevUpdatePrFunctionDef,
  DevMarkMergedFunctionDef,
  DevRenewLeaseFunctionDef,
  DevReapExpiredFunctionDef,
  DevAbandonFunctionDef,
]

/** The function-service slice the reconcile needs (Base get/create/update). */
export type TDevTeamFunctionService = {
  get: (id: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
  update: (item: any) => Promise<{ data?: any; error?: any }>
}

export type TDevTeamFunctionAction = `created` | `updated` | `unchanged` | `error`

export type TDevTeamFunctionsSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: {
    id: string
    name: string
    action: TDevTeamFunctionAction
    message?: string
  }[]
}

/** The declarative function-record fields the reconciler manages. */
export const devTeamFunctionRecordFields = (
  def: TDevTeamFunctionDef,
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
export const devTeamFunctionNeedsUpdate = (
  existing: any,
  def: TDevTeamFunctionDef,
  projectId: string
): boolean =>
  existing.name !== def.name ||
  (existing.description ?? null) !== def.description ||
  existing.content !== def.content ||
  existing.language !== def.language ||
  existing.projectId !== projectId

/**
 * Idempotently seed the ten dev-team Function records into the ops project:
 * missing row → create, drifted declarative field → update (git is the source
 * of truth for the bodies), else unchanged. Never throws — every outcome is
 * captured in the summary.
 */
export const reconcileDevTeamFunctions = async (
  service: TDevTeamFunctionService,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TDevTeamFunctionsSummary> => {
  const summary: TDevTeamFunctionsSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (def: TDevTeamFunctionDef, message?: string) => {
    summary.errors++
    summary.results.push({ id: def.id, name: def.name, action: `error`, message })
    log(`  ❌ function ${def.name} (${def.id}) — ${message ?? `unknown error`}`)
  }

  for (const def of DevTeamFunctionDefs) {
    try {
      const existing = await service.get(def.id)
      if (existing.error) {
        fail(def, `get failed: ${existing.error.message}`)
        continue
      }

      if (!existing.data) {
        const res = await service.create(devTeamFunctionRecordFields(def, projectId))
        if (res.error) fail(def, `create failed: ${res.error.message}`)
        else {
          summary.created++
          summary.results.push({ id: def.id, name: def.name, action: `created` })
          log(`  ✅ function ${def.name} (${def.id}) — created`)
        }
        continue
      }

      if (!devTeamFunctionNeedsUpdate(existing.data, def, projectId)) {
        summary.unchanged++
        summary.results.push({ id: def.id, name: def.name, action: `unchanged` })
        log(`  ➖ function ${def.name} (${def.id}) — unchanged`)
        continue
      }

      const res = await service.update(devTeamFunctionRecordFields(def, projectId))
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
