import { describe, it, expect } from 'vitest'

import { EFunLanguage } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import {
  DevTeamFunctionDefs,
  devTeamFunctionRecordFields,
  devTeamFunctionNeedsUpdate,
  reconcileDevTeamFunctions,
} from '@TDB/seeds/dev-team/functions'

/**
 * An in-memory fake of the function service's Base get/create/update slice,
 * keyed by id — enough to prove the reconcile creates missing Functions,
 * leaves in-sync ones untouched, and updates drifted bodies (git is the
 * source of truth) without a live DB. The Function BODIES' behavior (CAS
 * transitions, identity refusals, lease reaping) is exercised end to end
 * through the real FunctionExecutor in
 * repos/backend/src/utils/agent/devTeamFunctions.test.ts.
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

const byName = (name: string) => DevTeamFunctionDefs.find((def) => def.name === name)!

describe(`DevTeamFunctionDefs`, () => {
  it(`defines the nine state-machine Functions with unique names + stable ids`, () => {
    expect(DevTeamFunctionDefs).toHaveLength(9)
    expect(DevTeamFunctionDefs.map((def) => def.name)).toEqual([
      `devAddTask`,
      `devClaimTask`,
      `devSubmitPr`,
      `devClaimReview`,
      `devCompleteReview`,
      `devUpdatePr`,
      `devMarkMerged`,
      `devRenewLease`,
      `devReapExpired`,
    ])
    const ids = DevTeamFunctionDefs.map((def) => def.id)
    expect(new Set(ids).size).toBe(9)
    // Every id is a valid entity id (fn_ prefix + 7 chars = 10-char id shape).
    for (const id of ids) expect(id).toMatch(/^fn_[A-Za-z0-9_-]{7}$/)
  })

  it(`ships every body as plain-JS ESM with a default-export handler`, () => {
    for (const def of DevTeamFunctionDefs) {
      expect(def.language).toBe(EFunLanguage.javascript)
      expect(def.content.startsWith(`export default async (request, context)`)).toBe(true)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it(`gates every Function on the trusted context.caller identity, never args`, () => {
    for (const def of DevTeamFunctionDefs) {
      expect(def.content).toContain(`if (!caller.agentId)`)
      expect(def.content).toContain(`no caller identity`)
    }
  })

  it(`refuses a spoofed identity arg in every Function that accepts one`, () => {
    // devReapExpired takes no identity arg; every other body cross-checks the
    // passed agentId (or createdBy) against the platform-injected caller.
    for (const def of DevTeamFunctionDefs) {
      if (def.name === `devReapExpired`) continue
      expect(def.content).toContain(
        `the platform-injected caller identity is authoritative`
      )
    }
  })

  it(`routes EVERY state transition through records.cas — the machine's only write path`, () => {
    const transitionFns = [
      `devClaimTask`,
      `devSubmitPr`,
      `devClaimReview`,
      `devCompleteReview`,
      `devUpdatePr`,
      `devMarkMerged`,
      `devRenewLease`,
      `devReapExpired`,
    ]
    for (const name of transitionFns) {
      expect(byName(name).content).toContain(`records.cas(`)
      // A guard loss is a NORMAL outcome, surfaced as conflict — never thrown.
      expect(byName(name).content).toContain(`conflict`)
    }
    // devAddTask is the one non-transition write: a fresh backlog upsert.
    expect(byName(`devAddTask`).content).toContain(`records.upsert('dev_tasks'`)
    expect(byName(`devAddTask`).content).not.toContain(`records.cas(`)
  })

  it(`appends a race-safe {at, from, to, by} history entry on every transition`, () => {
    const transitionFns = [
      `devClaimTask`,
      `devSubmitPr`,
      `devClaimReview`,
      `devCompleteReview`,
      `devUpdatePr`,
      `devMarkMerged`,
      `devReapExpired`,
    ]
    for (const name of transitionFns) {
      const { content } = byName(name)
      expect(content).toContain(`history.push({ at: new Date(`)
      expect(content).toContain(`history: history`)
    }
    // Lease renewal is NOT a transition — no history entry.
    expect(byName(`devRenewLease`).content).not.toContain(`history.push`)
  })

  it(`platform-enforces reviewer independence in devClaimReview (never own PR)`, () => {
    const { content } = byName(`devClaimReview`)
    expect(content).toContain(`task.data.assignee === agentId`)
    expect(content).toContain(`an author never reviews their own work`)
    // Race-safe: the read assignee rides the CAS guard.
    expect(content).toContain(`assignee: assignee`)
  })

  it(`binds the review verdict to the recorded reviewer AND the exact headSha`, () => {
    const { content } = byName(`devCompleteReview`)
    expect(content).toContain(`you are not the recorded reviewer`)
    expect(content).toContain(`headSha mismatch`)
    expect(content).toContain(`notes are required when requesting changes`)
    expect(content).toContain(`reviewer: agentId, headSha: headSha`)
  })

  it(`devUpdatePr voids the stale review: clears reviewer + notes with the new head`, () => {
    const { content } = byName(`devUpdatePr`)
    expect(content).toContain(`state: 'changes_requested', assignee: agentId`)
    expect(content).toContain(`reviewer: null`)
    expect(content).toContain(`notes: ''`)
  })

  it(`devReapExpired guards on the exact lease read and NEVER calls GitHub from the isolate`, () => {
    const { content } = byName(`devReapExpired`)
    expect(content).toContain(`leaseExpiresAt: lease`)
    expect(content).toContain(`candidates`)
    // The CTO reconciles the returned lists against GitHub from its own VM.
    expect(content).not.toContain(`github.com/api`)
    expect(content).not.toContain(`fetch(`)
    expect(content).not.toContain(`context.connect`)
  })

  it(`stamps devAddTask's createdBy from the caller and dedupes open titles`, () => {
    const { content } = byName(`devAddTask`)
    expect(content).toContain(`createdBy: caller.agentId`)
    expect(content).toContain(`deduped: true`)
    expect(content).toContain(`state: 'backlog'`)
  })
})

describe(`reconcileDevTeamFunctions`, () => {
  it(`creates the nine Function records in the ops project when missing`, async () => {
    const { service, rows } = makeFakeService()

    const summary = await reconcileDevTeamFunctions(service)

    expect(summary).toMatchObject({ created: 9, updated: 0, unchanged: 0, errors: 0 })
    expect(rows.size).toBe(9)
    for (const def of DevTeamFunctionDefs) {
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

  it(`is idempotent — a re-run reports all nine unchanged and writes nothing`, async () => {
    const { service, rows } = makeFakeService()

    await reconcileDevTeamFunctions(service)
    const snapshot = new Map([...rows].map(([id, row]) => [id, { ...row }]))

    const second = await reconcileDevTeamFunctions(service)

    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 9, errors: 0 })
    expect(rows.size).toBe(9)
    for (const [id, row] of snapshot) expect(rows.get(id)).toEqual(row)
  })

  it(`updates a drifted Function body back to the git-versioned source`, async () => {
    const { service, rows } = makeFakeService()
    await reconcileDevTeamFunctions(service)

    const def = DevTeamFunctionDefs[0]
    rows.set(def.id, { ...rows.get(def.id), content: `export default () => 'drifted'` })

    const summary = await reconcileDevTeamFunctions(service)

    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 8, errors: 0 })
    expect(rows.get(def.id).content).toBe(def.content)
  })

  it(`records an error without throwing when a create fails`, async () => {
    const service = {
      get: async () => ({}),
      create: async () => ({ error: new Error(`boom`) }),
      update: async () => ({ data: {} }),
    }
    const summary = await reconcileDevTeamFunctions(service)
    expect(summary.errors).toBe(9)
    expect(summary.created).toBe(0)
    expect(summary.results.every((res) => res.action === `error`)).toBe(true)
  })

  it(`exposes drift detection over every declarative field`, () => {
    const def = DevTeamFunctionDefs[0]
    const inSync = devTeamFunctionRecordFields(def, OpsProjectId)
    expect(devTeamFunctionNeedsUpdate(inSync, def, OpsProjectId)).toBe(false)
    expect(
      devTeamFunctionNeedsUpdate({ ...inSync, content: `x` }, def, OpsProjectId)
    ).toBe(true)
    expect(devTeamFunctionNeedsUpdate({ ...inSync, name: `x` }, def, OpsProjectId)).toBe(
      true
    )
    expect(
      devTeamFunctionNeedsUpdate({ ...inSync, description: null }, def, OpsProjectId)
    ).toBe(true)
    expect(
      devTeamFunctionNeedsUpdate({ ...inSync, language: `typescript` }, def, OpsProjectId)
    ).toBe(true)
    expect(devTeamFunctionNeedsUpdate(inSync, def, `pj_other`)).toBe(true)
  })
})
