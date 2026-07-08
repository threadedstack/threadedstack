import { describe, it, expect } from 'vitest'

import { EFunLanguage } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import {
  DevLoopFunctionDefs,
  devLoopFunctionRecordFields,
  devLoopFunctionNeedsUpdate,
  reconcileDevLoopFunctions,
} from '@TDB/seeds/dev-loop/functions'

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

describe(`DevLoopFunctionDefs`, () => {
  it(`defines the five workflow Functions with unique names + stable ids`, () => {
    expect(DevLoopFunctionDefs).toHaveLength(5)
    expect(DevLoopFunctionDefs.map((def) => def.name)).toEqual([
      `proposeTask`,
      `pickupTask`,
      `openEscalation`,
      `resolveEscalation`,
      `recordVerification`,
    ])
    const ids = DevLoopFunctionDefs.map((def) => def.id)
    expect(new Set(ids).size).toBe(5)
    // Every id is a valid entity id (fn_ prefix + 7 chars = 10-char id shape).
    for (const id of ids) expect(id).toMatch(/^fn_[A-Za-z0-9_-]{7}$/)
  })

  it(`ships every body as plain-JS ESM with a default-export handler`, () => {
    for (const def of DevLoopFunctionDefs) {
      expect(def.language).toBe(EFunLanguage.javascript)
      expect(def.content.startsWith(`export default async (request, context)`)).toBe(true)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it(`gates every Function on the trusted context.caller identity, never args`, () => {
    for (const def of DevLoopFunctionDefs) {
      expect(def.content).toContain(`if (!caller.agentId)`)
      expect(def.content).toContain(`no caller identity`)
    }
  })

  it(`scan-gates proposeTask via context.scan and records the caller as proposer`, () => {
    const propose = DevLoopFunctionDefs.find((def) => def.name === `proposeTask`)!
    expect(propose.content).toContain(`context.scan`)
    expect(propose.content).toContain(`scan.content`)
    expect(propose.content).toContain(`proposedByAgentId: caller.agentId`)
  })

  it(`cross-writes the escalations collection inside recordVerification (multi-collection body)`, () => {
    const record = DevLoopFunctionDefs.find((def) => def.name === `recordVerification`)!
    expect(record.content).toContain(`records.upsert('escalations'`)
    expect(record.content).toContain(`records.upsert('verifications'`)
    expect(record.content).toContain(`verify-regression-pr`)
  })
})

describe(`reconcileDevLoopFunctions`, () => {
  it(`creates the five Function records in the ops project when missing`, async () => {
    const { service, rows } = makeFakeService()

    const summary = await reconcileDevLoopFunctions(service)

    expect(summary).toMatchObject({ created: 5, updated: 0, unchanged: 0, errors: 0 })
    expect(rows.size).toBe(5)
    for (const def of DevLoopFunctionDefs) {
      const row = rows.get(def.id)
      expect(row).toMatchObject({
        id: def.id,
        name: def.name,
        content: def.content,
        language: EFunLanguage.javascript,
        projectId: OpsProjectId,
      })
    }
  })

  it(`is idempotent — a re-run reports all five unchanged and writes nothing`, async () => {
    const { service, rows } = makeFakeService()

    await reconcileDevLoopFunctions(service)
    const snapshot = new Map([...rows].map(([id, row]) => [id, { ...row }]))

    const second = await reconcileDevLoopFunctions(service)

    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 5, errors: 0 })
    expect(rows.size).toBe(5)
    for (const [id, row] of snapshot) expect(rows.get(id)).toEqual(row)
  })

  it(`updates a drifted Function body back to the git-versioned source`, async () => {
    const { service, rows } = makeFakeService()
    await reconcileDevLoopFunctions(service)

    const def = DevLoopFunctionDefs[0]
    rows.set(def.id, { ...rows.get(def.id), content: `export default () => 'drifted'` })

    const summary = await reconcileDevLoopFunctions(service)

    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 4, errors: 0 })
    expect(rows.get(def.id).content).toBe(def.content)
  })

  it(`records an error without throwing when a create fails`, async () => {
    const service = {
      get: async () => ({}),
      create: async () => ({ error: new Error(`boom`) }),
      update: async () => ({ data: {} }),
    }
    const summary = await reconcileDevLoopFunctions(service)
    expect(summary.errors).toBe(5)
    expect(summary.created).toBe(0)
    expect(summary.results.every((res) => res.action === `error`)).toBe(true)
  })

  it(`exposes drift detection over every declarative field`, () => {
    const def = DevLoopFunctionDefs[0]
    const inSync = devLoopFunctionRecordFields(def, OpsProjectId)
    expect(devLoopFunctionNeedsUpdate(inSync, def, OpsProjectId)).toBe(false)
    expect(
      devLoopFunctionNeedsUpdate({ ...inSync, content: `x` }, def, OpsProjectId)
    ).toBe(true)
    expect(devLoopFunctionNeedsUpdate({ ...inSync, name: `x` }, def, OpsProjectId)).toBe(
      true
    )
    expect(
      devLoopFunctionNeedsUpdate({ ...inSync, description: null }, def, OpsProjectId)
    ).toBe(true)
    expect(
      devLoopFunctionNeedsUpdate({ ...inSync, language: `typescript` }, def, OpsProjectId)
    ).toBe(true)
    expect(devLoopFunctionNeedsUpdate(inSync, def, `pj_other`)).toBe(true)
  })
})
