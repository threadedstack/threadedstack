import { describe, it, expect } from 'vitest'

import { EFunLanguage } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import {
  ExecBoardFunctionDefs,
  functionNeedsUpdate,
  functionRecordFields,
  reconcileExecBoardFunctions,
} from '@TDB/seeds/exec-board/functions'

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

describe(`ExecBoardFunctionDefs`, () => {
  it(`defines the six board Functions with unique names + stable ids`, () => {
    expect(ExecBoardFunctionDefs).toHaveLength(6)
    expect(ExecBoardFunctionDefs.map((def) => def.name)).toEqual([
      `openDecision`,
      `postPosition`,
      `upsertStrategy`,
      `reportInitiativeComplete`,
      `saveMarketingArtifact`,
      `resolveBoard`,
    ])
    const ids = ExecBoardFunctionDefs.map((def) => def.id)
    expect(new Set(ids).size).toBe(6)
    // Every id is a valid entity id (fn_ prefix + 7 chars = 10-char id shape).
    for (const id of ids) expect(id).toMatch(/^fn_[A-Za-z0-9_-]{7}$/)
  })

  it(`ships every body as plain-JS ESM with a default-export handler`, () => {
    for (const def of ExecBoardFunctionDefs) {
      expect(def.language).toBe(EFunLanguage.javascript)
      expect(def.content.startsWith(`export default async (request, context)`)).toBe(true)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it(`gates the five effect Functions by the trusted context.caller, never args`, () => {
    const gated = ExecBoardFunctionDefs.filter((def) => def.name !== `resolveBoard`)
    for (const def of gated) {
      expect(def.content).toContain(`caller.agentId`)
      expect(def.content).toContain(`board_members`)
      // The membership lookup keys off the platform-injected caller identity.
      expect(def.content).toContain(
        `{ field: 'agentId', op: 'eq', value: caller.agentId }`
      )
    }
  })

  it(`inlines the board constants into the resolveBoard body`, () => {
    const resolve = ExecBoardFunctionDefs.find((def) => def.name === `resolveBoard`)!
    // Constants from repos/backend/src/constants/board.ts:46-80, inlined.
    expect(resolve.content).toContain(`const BoardMaxRounds = 3`)
    expect(resolve.content).toContain(`'STOP-THE-LINE:'`)
    expect(resolve.content).toContain(`'stop-the-line'`)
    expect(resolve.content).toContain(`blocked: active initiative in flight`)
    expect(resolve.content).toContain(
      `blocked: stop-the-line abort lacks full non-CEO endorsement`
    )
    expect(resolve.content).toContain(
      `blocked: stop-the-line abort has no wind-down plan`
    )
    expect(resolve.content).toContain(`ceo-tiebreak-reject`)
  })
})

describe(`reconcileExecBoardFunctions`, () => {
  it(`creates the six Function records in the exec project when missing`, async () => {
    const { service, rows } = makeFakeService()

    const summary = await reconcileExecBoardFunctions(service)

    expect(summary).toMatchObject({ created: 6, updated: 0, unchanged: 0, errors: 0 })
    expect(rows.size).toBe(6)
    for (const def of ExecBoardFunctionDefs) {
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

  it(`is idempotent — a re-run reports all six unchanged and writes nothing`, async () => {
    const { service, rows } = makeFakeService()

    await reconcileExecBoardFunctions(service)
    const snapshot = new Map([...rows].map(([id, row]) => [id, { ...row }]))

    const second = await reconcileExecBoardFunctions(service)

    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 6, errors: 0 })
    expect(rows.size).toBe(6)
    for (const [id, row] of snapshot) expect(rows.get(id)).toEqual(row)
  })

  it(`updates a drifted Function body back to the git-versioned source`, async () => {
    const { service, rows } = makeFakeService()
    await reconcileExecBoardFunctions(service)

    const def = ExecBoardFunctionDefs[0]
    rows.set(def.id, { ...rows.get(def.id), content: `export default () => 'drifted'` })

    const summary = await reconcileExecBoardFunctions(service)

    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 5, errors: 0 })
    expect(rows.get(def.id).content).toBe(def.content)
  })

  it(`records an error without throwing when a create fails`, async () => {
    const service = {
      get: async () => ({}),
      create: async () => ({ error: new Error(`boom`) }),
      update: async () => ({ data: {} }),
    }
    const summary = await reconcileExecBoardFunctions(service)
    expect(summary.errors).toBe(6)
    expect(summary.created).toBe(0)
    expect(summary.results.every((res) => res.action === `error`)).toBe(true)
  })

  it(`exposes drift detection over every declarative field`, () => {
    const def = ExecBoardFunctionDefs[0]
    const inSync = functionRecordFields(def, OpsProjectId)
    expect(functionNeedsUpdate(inSync, def, OpsProjectId)).toBe(false)
    expect(functionNeedsUpdate({ ...inSync, content: `x` }, def, OpsProjectId)).toBe(true)
    expect(functionNeedsUpdate({ ...inSync, name: `x` }, def, OpsProjectId)).toBe(true)
    expect(functionNeedsUpdate({ ...inSync, description: null }, def, OpsProjectId)).toBe(
      true
    )
    expect(
      functionNeedsUpdate({ ...inSync, language: `typescript` }, def, OpsProjectId)
    ).toBe(true)
    expect(functionNeedsUpdate(inSync, def, `pj_other`)).toBe(true)
  })
})
