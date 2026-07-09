import type { TAgentAction } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { invokeAction } from './invokeAction'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/functions/functionExecutor`, () => ({
  FunctionExecutor: { execute: vi.fn() },
}))

const mockExecute = FunctionExecutor.execute as ReturnType<typeof vi.fn>

/** A resolved Function record as returned by db.services.function.list. */
const mockFunc = {
  id: `fn-1`,
  name: `recordProposal`,
  content: `export default async () => ({})`,
  language: `typescript`,
  projectId: `proj-1`,
}

const buildDb = (listResult: any) =>
  ({
    services: {
      function: {
        list: vi.fn().mockResolvedValue(listResult),
      },
    },
  }) as any

const action: TAgentAction = { function: `recordProposal`, args: { title: `x` } }

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`invokeAction`, () => {
  it(`rejects a function not in the allowlist (and not authored by the caller) without executing`, async () => {
    const db = buildDb({ data: [mockFunc] })
    const res = await invokeAction({} as any, db, `proj-1`, action, [`other`], {
      agentId: `ag_someone`,
    })

    expect(res.ok).toBe(false)
    expect(res.error).toContain(`function not allowed`)
    expect(mockExecute).not.toHaveBeenCalled()
    // The Function IS resolved first now — authorship (meta.authoredBy) is the
    // second authorization path, so it must be looked up before rejecting.
    expect(db.services.function.list).toHaveBeenCalled()
  })

  it(`invokes a Function the caller AUTHORED even when it is not in the allowlist (authorship = authorization)`, async () => {
    // A self-authored tool carries meta.authoredBy = the caller agent.
    const authored = { ...mockFunc, meta: { authoredBy: `ag_builder`, version: 1 } }
    const db = buildDb({ data: [authored] })
    mockExecute.mockResolvedValue({ success: true, output: { built: true }, duration: 3 })

    // allowlist does NOT include the function; the caller authored it.
    const res = await invokeAction({} as any, db, `proj-1`, action, [`other`], {
      agentId: `ag_builder`,
    })

    expect(mockExecute).toHaveBeenCalledWith(authored, {
      db,
      context: { args: { title: `x` }, caller: { agentId: `ag_builder` } },
    })
    expect(res).toEqual({ ok: true, data: { built: true } })
  })

  it(`does NOT let an agent invoke another agent's authored Function outside the allowlist`, async () => {
    const authored = { ...mockFunc, meta: { authoredBy: `ag_other`, version: 1 } }
    const db = buildDb({ data: [authored] })

    const res = await invokeAction({} as any, db, `proj-1`, action, [`allowed-elsewhere`], {
      agentId: `ag_builder`,
    })

    expect(res.ok).toBe(false)
    expect(res.error).toContain(`function not allowed`)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it(`returns { ok:false } without throwing when the function is not found`, async () => {
    const db = buildDb({ data: [] })
    const res = await invokeAction({} as any, db, `proj-1`, action, [`recordProposal`])

    expect(res.ok).toBe(false)
    expect(res.error).toContain(`function not found`)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it(`returns { ok:false } when the db list surfaces an error`, async () => {
    const db = buildDb({ error: new Error(`db down`) })
    const res = await invokeAction({} as any, db, `proj-1`, action, [`recordProposal`])

    expect(res).toEqual({ ok: false, error: `db down` })
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it(`resolves + executes the function with { db, context:{ args } } and returns its output`, async () => {
    const db = buildDb({ data: [mockFunc] })
    mockExecute.mockResolvedValue({ success: true, output: { ok: true }, duration: 5 })

    const res = await invokeAction({} as any, db, `proj-1`, action, [`recordProposal`])

    expect(db.services.function.list).toHaveBeenCalledWith({
      where: { projectId: `proj-1`, name: `recordProposal` },
    })
    expect(mockExecute).toHaveBeenCalledWith(mockFunc, {
      db,
      context: { args: { title: `x` } },
    })
    expect(res).toEqual({ ok: true, data: { ok: true } })
  })

  it(`returns { ok:false } with the executor error when the function fails`, async () => {
    const db = buildDb({ data: [mockFunc] })
    mockExecute.mockResolvedValue({
      success: false,
      output: null,
      duration: 2,
      error: `boom`,
    })

    const res = await invokeAction({} as any, db, `proj-1`, action, [`recordProposal`])

    expect(res).toEqual({ ok: false, error: `boom` })
  })

  it(`never throws when the executor rejects — the failure is caught`, async () => {
    const db = buildDb({ data: [mockFunc] })
    mockExecute.mockRejectedValue(new Error(`isolate exploded`))

    const res = await invokeAction({} as any, db, `proj-1`, action, [`recordProposal`])

    expect(res).toEqual({ ok: false, error: `isolate exploded` })
  })

  it(`forwards a platform-injected caller into the executor context`, async () => {
    const db = buildDb({ data: [mockFunc] })
    mockExecute.mockResolvedValue({ success: true, output: { ok: true }, duration: 5 })

    const caller = { agentId: `ag_ceo0001`, scheduleId: `sch-board` }
    const res = await invokeAction(
      {} as any,
      db,
      `proj-1`,
      action,
      [`recordProposal`],
      caller
    )

    expect(mockExecute).toHaveBeenCalledWith(mockFunc, {
      db,
      context: { args: { title: `x` }, caller },
    })
    expect(res).toEqual({ ok: true, data: { ok: true } })
  })

  it(`leaves the context caller absent when none is passed (back-compat)`, async () => {
    const db = buildDb({ data: [mockFunc] })
    mockExecute.mockResolvedValue({ success: true, output: { ok: true }, duration: 5 })

    await invokeAction({} as any, db, `proj-1`, action, [`recordProposal`])

    const passedContext = mockExecute.mock.calls[0][1].context
    expect(passedContext.caller).toBeUndefined()
    expect(passedContext).toEqual({ args: { title: `x` } })
  })
})
