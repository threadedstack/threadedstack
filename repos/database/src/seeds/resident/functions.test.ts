import { describe, it, expect } from 'vitest'

import { EFunLanguage } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import {
  ResidentFunctionDefs,
  reconcileResidentFunctions,
  residentFunctionRecordFields,
  residentFunctionNeedsUpdate,
} from '@TDB/seeds/resident/functions'

/**
 * An in-memory fake of the function service's Base get/create/update slice,
 * keyed by id — enough to prove the reconcile creates missing Functions,
 * leaves in-sync ones untouched, and updates drifted bodies (git is the
 * source of truth) without a live DB.
 */
const makeFakeService = () => {
  const rows = new Map<string, any>()
  return {
    rows,
    service: {
      get: async (id: string) => {
        const row = rows.get(id)
        return row ? { data: { ...row } } : {}
      },
      create: async (item: any) => {
        rows.set(item.id, { ...item })
        return { data: { ...item } }
      },
      update: async (item: any) => {
        const row = rows.get(item.id)
        if (!row) return {}
        rows.set(item.id, { ...row, ...item })
        return { data: rows.get(item.id) }
      },
    },
  }
}

describe(`ResidentFunctionDefs`, () => {
  it(`defines the six resident Functions with unique names + stable ids`, () => {
    expect(ResidentFunctionDefs).toHaveLength(6)
    expect(ResidentFunctionDefs.map((def) => def.name)).toEqual([
      `sendAgentMessage`,
      `updateResidentConfig`,
      `heartbeat`,
      `appendTranscript`,
      `markMessageRead`,
      `writeMemory`,
    ])
    const ids = ResidentFunctionDefs.map((def) => def.id)
    expect(new Set(ids).size).toBe(6)
    // Every id is a valid entity id (fn_ prefix + 7 chars = 10-char id shape).
    for (const id of ids) expect(id).toMatch(/^fn_[A-Za-z0-9_-]{7}$/)
  })

  it(`ships every body as plain-JS ESM with a default-export handler`, () => {
    for (const def of ResidentFunctionDefs) {
      expect(def.language).toBe(EFunLanguage.javascript)
      expect(def.content.startsWith(`export default async (request, context)`)).toBe(true)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it(`gates every Function on the trusted context.caller identity, never args`, () => {
    for (const def of ResidentFunctionDefs) {
      expect(def.content).toContain(`if (!caller.agentId)`)
      expect(def.content).toContain(`no caller identity`)
    }
  })

  it(`stamps the caller as the message sender in sendAgentMessage (board/loop-agnostic — no membership gate)`, () => {
    const send = ResidentFunctionDefs.find((def) => def.name === `sendAgentMessage`)!
    expect(send.content).toContain(`from: caller.agentId`)
    // Any project agent may message any other — nothing resolves a membership
    // collection before the write.
    expect(send.content).not.toContain(`board_members`)
    expect(send.content).toContain(`readAt: null`)
  })

  it(`self-scopes updateResidentConfig to the caller's own record with recognized fields only`, () => {
    const update = ResidentFunctionDefs.find(
      (def) => def.name === `updateResidentConfig`
    )!
    // The record is resolved BY the caller identity — no args-supplied id/agentId.
    expect(update.content).toContain(
      `{ field: 'agentId', op: 'eq', value: caller.agentId }`
    )
    // Recognized-fields-only patch surface.
    expect(update.content).toContain(`['agenda', 'watches', 'actions']`)
    for (const field of [
      `inbox`,
      `compaction`,
      `session`,
      `subAgents`,
      `selfDirected`,
      `functions`,
    ])
      expect(update.content).toContain(`'${field}'`)
    expect(update.content).toContain(`no recognized config fields in patch`)
    // agentId is re-pinned to the caller so the record can never be re-homed.
    expect(update.content).toContain(`agentId: caller.agentId`)
  })

  it(`upserts resident_status by the caller identity and MERGES (never writes watchdog-owned degraded)`, () => {
    const beat = ResidentFunctionDefs.find((def) => def.name === `heartbeat`)!
    expect(beat.content).toContain(`resident_status`)
    expect(beat.content).toContain(
      `{ field: 'agentId', op: 'eq', value: caller.agentId }`
    )
    // The watchdog is the SOLE owner of `degraded` — the beat must merge over
    // the existing record and never write the flag (else a live beat would
    // clobber the watchdog's crash-loop assessment).
    expect(beat.content).toContain(`...prev`)
    expect(beat.content).not.toContain(`degraded`)
  })

  it(`appends caller-stamped resident_transcripts records (records-only thread stand-in)`, () => {
    const transcript = ResidentFunctionDefs.find(
      (def) => def.name === `appendTranscript`
    )!
    expect(transcript.content).toContain(`resident_transcripts`)
    expect(transcript.content).toContain(`agentId: caller.agentId`)
    // Append = create: the upsert carries NO id, so every turn is a new record.
    expect(transcript.content).not.toMatch(/upsert\('resident_transcripts',\s*\{\s*id/)
  })

  it(`gates markMessageRead on the message being addressed to the caller`, () => {
    const mark = ResidentFunctionDefs.find((def) => def.name === `markMessageRead`)!
    expect(mark.content).toContain(`message.data.to !== caller.agentId`)
    expect(mark.content).toContain(`message is not addressed to caller`)
    expect(mark.content).toContain(`already read`)
  })
})

describe(`reconcileResidentFunctions`, () => {
  it(`creates the six Function records in the target project when missing`, async () => {
    const { service, rows } = makeFakeService()

    const summary = await reconcileResidentFunctions(service)

    expect(summary).toMatchObject({ created: 6, updated: 0, unchanged: 0, errors: 0 })
    expect(rows.size).toBe(6)
    for (const def of ResidentFunctionDefs) {
      expect(rows.get(def.id)).toMatchObject({
        id: def.id,
        name: def.name,
        content: def.content,
        language: EFunLanguage.javascript,
        projectId: OpsProjectId,
      })
    }
  })

  it(`is idempotent — a re-run reports all six unchanged and writes nothing`, async () => {
    const { service, rows } = makeFakeService()

    await reconcileResidentFunctions(service)
    const snapshot = new Map([...rows].map(([id, row]) => [id, { ...row }]))

    const second = await reconcileResidentFunctions(service)

    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 6, errors: 0 })
    for (const [id, row] of snapshot) expect(rows.get(id)).toEqual(row)
  })

  it(`updates a drifted body in place (git is the source of truth)`, async () => {
    const { service, rows } = makeFakeService()
    await reconcileResidentFunctions(service)

    const target = ResidentFunctionDefs[0]
    rows.set(target.id, { ...rows.get(target.id), content: `export default null` })

    const summary = await reconcileResidentFunctions(service)

    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 5, errors: 0 })
    expect(rows.get(target.id).content).toBe(target.content)
  })

  it(`captures per-function failures without aborting the run`, async () => {
    const { service } = makeFakeService()
    const failing = {
      get: service.get,
      update: service.update,
      create: async (item: any) =>
        item.name === `heartbeat`
          ? { error: new Error(`insert refused`) }
          : service.create(item),
    }

    const summary = await reconcileResidentFunctions(failing)

    expect(summary.errors).toBe(1)
    expect(summary.created).toBe(5)
    const failed = summary.results.find((r) => r.action === `error`)
    expect(failed).toMatchObject({ name: `heartbeat` })
    expect(failed?.message).toContain(`insert refused`)
  })

  it(`residentFunctionNeedsUpdate detects drift on every declarative field`, () => {
    const def = ResidentFunctionDefs[0]
    const inSync = residentFunctionRecordFields(def, OpsProjectId)
    expect(residentFunctionNeedsUpdate(inSync, def, OpsProjectId)).toBe(false)
    expect(
      residentFunctionNeedsUpdate({ ...inSync, name: `other` }, def, OpsProjectId)
    ).toBe(true)
    expect(
      residentFunctionNeedsUpdate({ ...inSync, description: `x` }, def, OpsProjectId)
    ).toBe(true)
    expect(
      residentFunctionNeedsUpdate({ ...inSync, content: `x` }, def, OpsProjectId)
    ).toBe(true)
    expect(
      residentFunctionNeedsUpdate({ ...inSync, language: `python` }, def, OpsProjectId)
    ).toBe(true)
    expect(residentFunctionNeedsUpdate(inSync, def, `pj_other001`)).toBe(true)
  })
})
