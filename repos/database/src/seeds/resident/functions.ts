import type { EFunLanguage } from '@tdsk/domain'

import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { HeartbeatFunctionDef } from '@TDB/seeds/resident/functions/heartbeat'
import { MarkMessageReadFunctionDef } from '@TDB/seeds/resident/functions/markMessageRead'
import { SendAgentMessageFunctionDef } from '@TDB/seeds/resident/functions/sendAgentMessage'
import { WriteMemoryFunctionDef } from '@TDB/seeds/resident/functions/writeMemory'
import { AppendTranscriptFunctionDef } from '@TDB/seeds/resident/functions/appendTranscript'
import { UpdateResidentConfigFunctionDef } from '@TDB/seeds/resident/functions/updateResidentConfig'

/**
 * Resident effect Function seeding — Resident Agents R3 (spec §2).
 *
 * The 5 resident Functions (sendAgentMessage / updateResidentConfig /
 * heartbeat / appendTranscript / markMessageRead) live as git-versioned source
 * strings in `seeds/resident/functions/*` and reconcile into the target
 * project's `functions` table here, the same declarative pattern as
 * `reconcileDevLoopFunctions`: missing → create, drifted (name/description/
 * content/language/projectId) → update, else unchanged (no churn). Pure and
 * DB-agnostic (injected service slice), so it is unit-testable without a live
 * connection; the deploy runner in `scripts/reconcileResident.ts` wires it to
 * the real function service.
 *
 * A Function is invocable only by a resident whose resident_configs record
 * carries it on its `actions` allowlist — the CMO pilot's record
 * (seeds/resident/records.ts) carries all five.
 */

/** A resident Function definition: stable id + the seedable function record fields. */
export type TResidentFunctionDef = {
  id: string
  name: string
  description: string
  language: EFunLanguage
  content: string
}

/** The resident effect Functions, in invocation-surface order. */
export const ResidentFunctionDefs: TResidentFunctionDef[] = [
  SendAgentMessageFunctionDef,
  UpdateResidentConfigFunctionDef,
  HeartbeatFunctionDef,
  AppendTranscriptFunctionDef,
  MarkMessageReadFunctionDef,
  WriteMemoryFunctionDef,
]

/** The function-service slice the reconcile needs (Base get/create/update). */
export type TResidentFunctionService = {
  get: (id: string) => Promise<{ data?: any; error?: any }>
  create: (item: any) => Promise<{ data?: any; error?: any }>
  update: (item: any) => Promise<{ data?: any; error?: any }>
}

export type TResidentFunctionAction = `created` | `updated` | `unchanged` | `error`

export type TResidentFunctionsSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: {
    id: string
    name: string
    action: TResidentFunctionAction
    message?: string
  }[]
}

/** The declarative function-record fields the reconciler manages. */
export const residentFunctionRecordFields = (
  def: TResidentFunctionDef,
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
export const residentFunctionNeedsUpdate = (
  existing: any,
  def: TResidentFunctionDef,
  projectId: string
): boolean =>
  existing.name !== def.name ||
  (existing.description ?? null) !== def.description ||
  existing.content !== def.content ||
  existing.language !== def.language ||
  existing.projectId !== projectId

/**
 * Idempotently seed the five resident Function records into the target
 * project: missing row → create, drifted declarative field → update (git is
 * the source of truth for the bodies), else unchanged. Never throws — every
 * outcome is captured in the summary.
 */
export const reconcileResidentFunctions = async (
  service: TResidentFunctionService,
  projectId: string = OpsProjectId,
  log: (msg: string) => void = () => {}
): Promise<TResidentFunctionsSummary> => {
  const summary: TResidentFunctionsSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (def: TResidentFunctionDef, message?: string) => {
    summary.errors++
    summary.results.push({ id: def.id, name: def.name, action: `error`, message })
    log(`  ❌ function ${def.name} (${def.id}) — ${message ?? `unknown error`}`)
  }

  for (const def of ResidentFunctionDefs) {
    try {
      const existing = await service.get(def.id)
      if (existing.error) {
        fail(def, `get failed: ${existing.error.message}`)
        continue
      }

      if (!existing.data) {
        const res = await service.create(residentFunctionRecordFields(def, projectId))
        if (res.error) fail(def, `create failed: ${res.error.message}`)
        else {
          summary.created++
          summary.results.push({ id: def.id, name: def.name, action: `created` })
          log(`  ✅ function ${def.name} (${def.id}) — created`)
        }
        continue
      }

      if (!residentFunctionNeedsUpdate(existing.data, def, projectId)) {
        summary.unchanged++
        summary.results.push({ id: def.id, name: def.name, action: `unchanged` })
        log(`  ➖ function ${def.name} (${def.id}) — unchanged`)
        continue
      }

      const res = await service.update(residentFunctionRecordFields(def, projectId))
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
